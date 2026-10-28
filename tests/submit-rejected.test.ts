/**
# Rejected Submit Queues No Job

A submit the server rejects at intake records the node and nothing else.

## 1. What This Module Does
Submits a commit that touches a pinned path and one that does not descend from its parent, then checks that neither creates a job.
## 2. Why This Module Exists
A rejected submit used to insert a `review` job, emit `job_queued`, and mark it `done` with no verdicts, so the submit response and status pointed at a review that never ran.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
A node rejected at intake has `job: null` on submit and on status; the runner has nothing to lease.
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
import { SubmitOut } from '../src/models.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('a submit rejected for a pinned path or a foreign commit creates no job',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-submit-rejected-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'agent','baseline','[]','[]','merged',1,base,at);
    const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const submit=(scope:string,intent:string)=>{
      const claim=state.write(agent,'/claims',{parent:'n_0',scope:[scope],intent}) as {lease:string};
      const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      return SubmitOut.parse(state.write(agent,'/submit',{lease:claim.lease,commit}));
    };
    writeFileSync(join(source,'fervo.toml'),'# unauthorized\n',{flag:'a'});git(source,'add','fervo.toml');git(source,'commit','-qm','change policy');
    const pinned=submit('fervo.toml','change policy');
    git(source,'checkout','-q','--orphan','foreign');writeFileSync(join(source,'score.txt'),'12\n');git(source,'add','.');git(source,'commit','-qm','foreign history');
    const foreign=submit('score.txt','raise score from elsewhere');
    for(const [out,reason] of [[pinned,'touched pinned paths: fervo.toml'],[foreign,'commit does not descend from parent']] as const){
      assert.equal(out.job,null);
      const status=state.status(out.node) as {state:string;reason:string;job:string|null;next_action:string};
      assert.equal(status.state,'rejected');assert.equal(status.reason,reason);assert.equal(status.job,null);assert.equal(status.next_action,'stop');
      assert.equal(db.prepare('SELECT 1 FROM jobs WHERE node=?').get(out.node),undefined,'no job row for a rejected node');
    }
    assert.equal(db.prepare("SELECT 1 FROM events WHERE type='job_queued'").get(),undefined,'no job_queued event');
    assert.equal(state.lease(runner),null,'runner has nothing to lease');
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
