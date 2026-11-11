/**
# Postmerge Failure Handling

What the server does when tests fail on a node that has already reached `main`.

## 1. What This Module Does
Merges two nodes in sequence, then fails the first node's postmerge job.
## 2. Why This Module Exists
Reverting a node that `main` has moved past used to crash the result transaction and the runner.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
The automatic revert runs only while the node is the head of `main`; otherwise the node records the failure and waits for a human.
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

test('postmerge failure on a node main has moved past records a reason instead of reverting',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-postmerge-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const merge=(parent:string,score:string)=>{
      const claim=state.write(agent,'/claims',{parent,scope:['score.txt'],intent:`raise score to ${score}`}) as {lease:string};
      writeFileSync(join(source,'score.txt'),`${score}\n`);git(source,'add','score.txt');git(source,'commit','-qm',`raise score to ${score}`);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      const node=(state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node;
      const job=state.lease(runner) as {id:string;kind:string;node:string};assert.equal(job.kind,'eval');assert.equal(job.node,node);
      state.result(runner,job.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
      assert.equal((state.status(node) as {state:string}).state,'merged');
      return {node,commit};
    };
    const first=merge('n_0','12');
    const postmerge=state.lease(runner) as {id:string;kind:string;node:string};assert.equal(postmerge.kind,'postmerge');assert.equal(postmerge.node,first.node);
    const second=merge(first.node,'14');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),second.commit);
    const status=state.result(runner,postmerge.id,{verdicts:[{producer:'tests',provider:null,passed:false,samples:null,evidence:'regression found after merge',recipe_hash:'test'}]}) as {state:string};
    assert.equal(status.state,'done');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),second.commit);
    const node=state.status(first.node) as {state:string;reason:string;next_action:string};
    assert.equal(node.state,'merged');assert.match(node.reason,/revert manually/);assert.equal(node.next_action,'stop');
    assert.ok(db.prepare("SELECT 1 FROM events WHERE type='postmerge_failed' AND subject=?").get(first.node));
    assert.equal(db.prepare("SELECT 1 FROM events WHERE type='node_reverted'").get(),undefined,'no revert recorded');
    const later=state.lease(runner) as {id:string;node:string};assert.equal(later.node,second.node);
    state.result(runner,later.id,{verdicts:[{producer:'tests',provider:null,passed:false,samples:null,evidence:'regression found after merge',recipe_hash:'test'}]});
    assert.equal((state.status(second.node) as {state:string}).state,'reverted');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),first.commit);
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
