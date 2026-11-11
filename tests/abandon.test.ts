/**
# Abandon and Veto State Guard

Which node states `abandon` and `veto` may move to `abandoned`.

## 1. What This Module Does
Merges a node, then tries to abandon and veto it, and checks that `main` stays claimable.
## 2. Why This Module Exists
Abandoning the merged node that `main` points to used to wedge the repository: no claim could name it as a parent, and `revert` refused it because it was no longer `merged`.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
`abandon` and `veto` act only on open nodes (`submitted`, `evaluating`, `verified`, `failed`). `revert` is the only path off `merged`.
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

test('abandon and veto refuse merged and other terminal nodes, and still work on open nodes',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-abandon-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const human={id:'human',kind:'human'};const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const submit=(parent:string,score:string)=>{
      const claim=state.write(agent,'/claims',{parent,scope:['score.txt'],intent:`raise score to ${score}`}) as {lease:string};
      writeFileSync(join(source,'score.txt'),`${score}\n`);git(source,'add','score.txt');git(source,'commit','-qm',`raise score to ${score}`);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      return {node:(state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node,commit};
    };
    const merged=submit('n_0','12');
    const job=state.lease(runner) as {id:string;kind:string;node:string};assert.equal(job.kind,'eval');assert.equal(job.node,merged.node);
    state.result(runner,job.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
    assert.equal((state.status(merged.node) as {state:string}).state,'merged');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),merged.commit);

    assert.throws(()=>state.write(agent,`/nodes/${merged.node}/abandon`,{reason:'oops'}),/node is merged: revert it instead/);
    assert.throws(()=>state.write(human,`/nodes/${merged.node}/veto`,{reason:'oops'}),/node is merged: revert it instead/);
    assert.throws(()=>state.write(human,'/nodes/n_0/veto',{reason:'oops'}),/node is merged: revert it instead/);
    assert.equal((state.status(merged.node) as {state:string}).state,'merged');
    assert.equal(db.prepare("SELECT 1 FROM verdicts WHERE producer='human'").get(),undefined,'no override verdict recorded');
    assert.equal(db.prepare("SELECT 1 FROM events WHERE type IN ('human_abandon','human_veto')").get(),undefined,'no override event recorded');
    // main is still claimable and revertable: the repository is not wedged
    const open=submit(merged.node,'14');
    state.write(human,`/nodes/${merged.node}/revert`,{reason:'back out'});
    assert.equal((state.status(merged.node) as {state:string}).state,'reverted');
    assert.throws(()=>state.write(human,`/nodes/${merged.node}/veto`,{reason:'oops'}),/node is already reverted/);
    // open nodes can still be abandoned, once
    assert.equal((state.status(open.node) as {state:string}).state,'submitted');
    assert.equal((state.write(agent,`/nodes/${open.node}/abandon`,{reason:'giving up'}) as {state:string;reason:string}).state,'abandoned');
    assert.throws(()=>state.write(human,`/nodes/${open.node}/veto`,{reason:'again'}),/node is already abandoned/);
    assert.equal((state.status(open.node) as {reason:string}).reason,'giving up');
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
