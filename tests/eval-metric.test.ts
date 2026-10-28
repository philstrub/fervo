/**
# Eval Metric Validation

What the runner does when a metric command prints something that is not a measurement.

## 1. What This Module Does
Runs a real eval job against a worktree whose metric output is non-numeric.
## 2. Why This Module Exists
An unchecked `Number(...)` turned garbage output into NaN gains and a verified node with no score.
## 3. How It Fits in the Architecture
This drives `executeJob` directly on a mirror clone without server or model calls.
## 4. Key Concepts
Every measurement must be a finite positive number, in eval just as in baseline; anything else fails the job with a named error.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeJob } from '../src/runner/run.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('eval job fails with a clear error when a metric prints a non-numeric measurement',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-eval-metric-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="score"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[eval]\nsamples=2\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');const parent=git(source,'rev-parse','HEAD');
    writeFileSync(join(source,'score.txt'),'error: benchmark crashed\n');git(source,'add','score.txt');git(source,'commit','-qm','break metric');const commit=git(source,'rev-parse','HEAD');
    git(source,'update-ref','refs/heads/main',parent);
    const mirror=join(tmp,'repo.git');git(tmp,'clone','--mirror','-q',source,mirror);
    const settings={anthropicModel:'fake',openaiModel:'fake',reviewProvider:'anthropic',reviewModel:'fake',judgeTemplate:'Compare the change',reviewTemplate:'Review the change'};
    const job={id:'j_1',kind:'eval' as const,node:'n_1',state:'running' as const,commit,parent_commit:parent,intent:'break metric',scope:['score.txt'],author_provider:'openai',baselines:{score:{mean:10,sd:1}}};
    await assert.rejects(executeJob(job,mirror,settings,async()=>({preference:0.5,evidence:'unused'})),/invalid score measurement/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
