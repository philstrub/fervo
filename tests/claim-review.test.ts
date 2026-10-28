/**
# Claim Review Gate

An optional early review before an agent can submit a lease.

## 1. What This Module Does
Checks claim-review job creation, runner ownership, and submit gating.
## 2. Why This Module Exists
A pending review must not be silently skipped when the gate is enabled.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
Review verdicts belong to the claim; submission requires a passing verdict.
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

test('configured claim review blocks submit until a runner verdict passes',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-claim-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[claim_review]\nenabled=true\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const claim=state.write(agent,'/claims',{parent:'n_0',scope:['score.txt'],intent:'raise score'}) as {lease:string;review_job:string};assert.ok(claim.review_job);
    writeFileSync(join(source,'score.txt'),'12\n');git(source,'add','score.txt');git(source,'commit','-qm','raise score');const commit=git(source,'rev-parse','HEAD');git(source,'push',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
    assert.throws(()=>state.write(agent,'/submit',{lease:claim.lease,commit}),/claim review has not passed/);
    const job=state.lease(runner) as {id:string;kind:string};assert.equal(job.kind,'claim_review');
    state.result(runner,job.id,{verdicts:[{producer:'claim_review',provider:'anthropic',passed:true,samples:null,evidence:'scope matches intent',recipe_hash:'test'}]});
    const node=(state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node;assert.equal(node.startsWith('n_'),true);
    const evalJob=state.lease(runner) as {id:string;kind:string};assert.equal(evalJob.kind,'eval');
    state.result(runner,evalJob.id,{verdicts:[],error:'metric command timed out'});
    assert.equal((state.status(node) as {next_action:string}).next_action,'retry');
    assert.equal((state.write(agent,`/nodes/${node}/retry`,{}) as {state:string}).state,'submitted');
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
