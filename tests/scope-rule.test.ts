/**
# Scope Rule Tests

A node that changes paths outside its claim is rejected when, and only when, policy requires `scope`.

## 1. What This Module Does
Submits the same out-of-scope change under two policies and evaluates it through `State`.
## 2. Why This Module Exists
`--scope` was advisory: nothing compared it with what a node changed.
## 3. How It Fits in the Architecture
Drives `State` directly with a runner verdict, as `human-review.test.ts` does.
## 4. Key Concepts
The claim's scope is `score.txt`; the node also changes `notes.md`.
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
import { builtinServerExtensions } from '../src/server/extensions.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

function outOfScope(require:string):{state:string;reason:string|null}{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-scope-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),`[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=${require}\n`);
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root,builtinServerExtensions);const at=new Date().toISOString();
    for(const [id,kind] of [['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'agent','baseline','[]','[]','merged',1,base,at);
    const claim=state.write({id:'agent',kind:'agent'},'/claims',{parent:'n_0',scope:['score.txt'],intent:'raise'}) as {lease:string};
    writeFileSync(join(source,'score.txt'),'12\n');writeFileSync(join(source,'notes.md'),'why\n');git(source,'add','.');git(source,'commit','-qm','raise');const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
    const node=(state.write({id:'agent',kind:'agent'},'/submit',{lease:claim.lease,commit}) as {node:string}).node;
    const job=state.lease({id:'runner',kind:'runner'}) as {id:string};
    state.result({id:'runner',kind:'runner'},job.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
    const status=state.status(node) as {state:string;reason:string|null};db.close();
    return {state:status.state,reason:status.reason};
  }finally{rmSync(tmp,{recursive:true,force:true});}
}

test('scope rejects an out-of-scope node only when policy requires it',()=>{
  assert.deepEqual(outOfScope('["tests","scope"]'),{state:'rejected',reason:"changed paths outside the claim's scope: notes.md"});
  assert.deepEqual(outOfScope('["tests"]'),{state:'merged',reason:null});
});
