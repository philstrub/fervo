/**
# Human Review Verdicts

A human `--fail` must reject the node; a human `--pass` must merge it.

## 1. What This Module Does
Drives a verified node through both human verdict outcomes with the real state writer.
## 2. Why This Module Exists
A failing human verdict once left the node verified with next_action `wait`, so the author's wait loop never ended.
## 3. How It Fits in the Architecture
Policy rules are pure; this test pins what the `human` rule does to a live node and to `main`.
## 4. Key Concepts
The verdict evidence becomes the rejection reason; `main` only moves on a passing verdict.
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

test('human fail rejects a verified node and human pass merges it',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-human-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests","human"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const human={id:'human',kind:'human'};const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const verify=(score:string)=>{
      const claim=state.write(agent,'/claims',{parent:'n_0',scope:['score.txt'],intent:`raise score to ${score}`}) as {lease:string};
      writeFileSync(join(source,'score.txt'),`${score}\n`);git(source,'add','score.txt');git(source,'commit','-qm',`raise score to ${score}`);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      const node=(state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node;
      const job=state.lease(runner) as {id:string;node:string};assert.equal(job.node,node);
      state.result(runner,job.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
      assert.deepEqual([(state.status(node) as {state:string}).state,(state.status(node) as {next_action:string}).next_action],['verified','wait']);
      return {node,commit};
    };
    const rejected=verify('12');
    const verdict=state.write(human,`/nodes/${rejected.node}/verdicts`,{passed:false,evidence:'breaks login'}) as {passed:boolean};assert.equal(verdict.passed,false);
    const after=state.status(rejected.node) as {state:string;reason:string;next_action:string};
    assert.equal(after.state,'rejected');
    assert.equal(after.reason,'breaks login');
    assert.equal(after.next_action,'stop');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),base);

    git(source,'reset','-q','--hard',base);
    const merged=verify('14');
    state.write(human,`/nodes/${merged.node}/verdicts`,{passed:true,evidence:'looks good'});
    assert.equal((state.status(merged.node) as {state:string}).state,'merged');
    assert.equal(bareGit(state.repo,'rev-parse','refs/heads/main'),merged.commit);
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
