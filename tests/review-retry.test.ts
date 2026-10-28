/**
# Review Job Retry

A review job that cannot run must leave a verified node retryable.

## 1. What This Module Does
Fails a node's review job both ways (runner error, lease attempts exhausted) and retries it with the real state writer.
## 2. Why This Module Exists
A failed review job once left the node `verified` with `next_action: stop`, `retry` refused it, and policy never queued another review.
## 3. How It Fits in the Architecture
Policy decides which jobs to queue; this test pins that a failed review job does not count as an existing one.
## 4. Key Concepts
The node keeps its scores while the review is retried; `main` moves only once a new review passes.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/store/db.js';
import { State } from '../src/server/state.js';
import { bareGit } from '../src/server/git.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('a failed review job leaves the node retryable and retry queues a new review',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-review-retry-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests","review"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const status=(node:string)=>state.status(node) as {state:string;reason:string|null;next_action:string;delta:number|null};
    const verify=(score:string,parent:string)=>{
      const claim=state.write(agent,'/claims',{parent,scope:['score.txt'],intent:`raise score to ${score}`}) as {lease:string};
      writeFileSync(join(source,'score.txt'),`${score}\n`);git(source,'add','score.txt');git(source,'commit','-qm',`raise score to ${score}`);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      const node=(state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node;
      const evalJob=state.lease(runner) as {id:string;kind:string;node:string};assert.deepEqual([evalJob.kind,evalJob.node],['eval',node]);
      state.result(runner,evalJob.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
      const reviewJob=state.lease(runner) as {id:string;kind:string;node:string};assert.deepEqual([reviewJob.kind,reviewJob.node],['review',node]);
      return {node,commit,reviewJob:reviewJob.id};
    };
    const retryAndPass=(node:string,commit:string)=>{
      const retried=state.write(agent,`/nodes/${node}/retry`,{}) as {state:string;reason:string|null;next_action:string};
      assert.deepEqual([retried.state,retried.reason,retried.next_action],['verified',null,'wait']);
      const again=state.lease(runner) as {id:string;kind:string;node:string};assert.deepEqual([again.kind,again.node],['review',node]);
      state.result(runner,again.id,{verdicts:[{producer:'review',provider:'anthropic',passed:true,samples:null,evidence:'looks good',recipe_hash:'test'}]});
      assert.equal(status(node).state,'merged');
      assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),commit);
      assert.equal((state.lease(runner) as {kind:string}).kind,'postmerge');
    };

    const errored=verify('12','n_0');
    state.result(runner,errored.reviewJob,{verdicts:[],error:'429 rate limited'});
    assert.deepEqual([status(errored.node).state,status(errored.node).reason,status(errored.node).next_action],['verified','review unavailable: 429 rate limited','retry']);
    assert.ok(status(errored.node).delta!>0);
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),base);
    retryAndPass(errored.node,errored.commit);

    const exhausted=verify('14',errored.node);
    for(let attempt=0;attempt<2;attempt++){db.prepare('UPDATE jobs SET lease_until=? WHERE id=?').run('2000-01-01T00:00:00.000Z',exhausted.reviewJob);assert.equal((state.lease(runner) as {id:string}).id,exhausted.reviewJob);}
    db.prepare('UPDATE jobs SET lease_until=? WHERE id=?').run('2000-01-01T00:00:00.000Z',exhausted.reviewJob);
    assert.equal(state.lease(runner),null);
    assert.deepEqual([status(exhausted.node).state,status(exhausted.node).reason,status(exhausted.node).next_action],['verified','review lease attempts exhausted','retry']);
    assert.throws(()=>state.write({id:'other',kind:'agent'},`/nodes/${exhausted.node}/retry`,{}),/only author or human may retry/);
    retryAndPass(exhausted.node,exhausted.commit);

    assert.throws(()=>state.write(agent,`/nodes/${exhausted.node}/retry`,{}),/only failed nodes or failed reviews can retry/);
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
