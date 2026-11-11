/**
# Event Lifecycle Tests

The event log records every coordination step a study scores from it.

## 1. What This Module Does
Drives two parallel claims to a merge and a stale merge, lets a third claim expire, and reads the log.
## 2. Why This Module Exists
Benchmark scoring reads claims, submissions, merges, rebases and expiries from `fervo events` alone.
## 3. How It Fits in the Architecture
Uses the CLI, the server and the runner over real HTTP, as the end-to-end test does.
## 4. Key Concepts
Expiry is forced by moving one claim's deadline into the past; the next request expires it.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { runRunner } from '../src/runner/run.js';

const cli=resolve('dist/src/cli/main.js');
function run(cwd:string,env:NodeJS.ProcessEnv,bin:string,...args:string[]):string {const r=spawnSync(bin,args,{cwd,env,encoding:'utf8'});assert.equal(r.status,0,`${bin} ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function command(cwd:string,bin:string,...args:string[]):string {return run(cwd,process.env,bin,...args);}
function fervo(cwd:string,...args:string[]):any{return JSON.parse(command(cwd,process.execPath,cli,...args));}

test('the event log shows claims, submissions, a merge, a needed rebase and an expired claim',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-lifecycle-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);
    command(source,'git','init','-q','-b','main');command(source,'git','config','user.email','test@example.com');command(source,'git','config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),`[goal]\ntext = "Raise the score"\n[tests]\ncmd = "test -f score.txt"\n[[metrics]]\nname = "score"\ncmd = "cat score.txt"\ndirection = "max"\nweight = 1\n[eval]\nsamples = 3\nbaseline_samples = 5\n[pinned]\npaths = ["fervo.toml"]\n[merge.main]\nrequire = ["tests"]\n`);
    writeFileSync(join(source,'score.txt'),'10\n');command(source,'git','add','.');command(source,'git','commit','-qm','baseline');
    const root=join(tmp,'manager');const init=fervo(tmp,'init','--source',source,'--root',root,'--actor','operator');
    const probe=createNetServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address!=='string');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    await new Promise<void>((resolve,reject)=>{server.stderr.on('data',(data:Buffer)=>{if(data.toString().includes('listening'))resolve();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const human=join(tmp,'human');fervo(tmp,'clone',url,human,'--token',init.token);
      const asHuman=(...args:string[])=>run(human,{...process.env,FERVO_TOKEN:init.token},process.execPath,cli,...args);
      const runner=JSON.parse(asHuman('actor','add','runner','--kind','runner','--key','add-runner'));
      const settings={anthropicModel:'fake',openaiModel:'fake',reviewProvider:'anthropic',reviewModel:'fake',judgeTemplate:'Compare the change',reviewTemplate:'Review the change'};
      const model=async()=>({passed:true,evidence:'fake'});
      const drain=async()=>{for(let i=0;i<8;i++)await runRunner(url,runner.token,settings,model,true);};
      await drain();
      const agents=['a','b','c'].map(name=>{
        const agent=JSON.parse(asHuman('actor','add',`agent-${name}`,'--kind','agent','--provider','openai','--model','test','--harness','script','--key',`add-${name}`));
        const clone=join(tmp,name);fervo(tmp,'clone',url,clone,'--token',agent.token);
        command(clone,'git','config','user.email',`${name}@example.com`);command(clone,'git','config','user.name',name);
        return clone;
      });
      const submitted=agents.slice(0,2).map((clone,i)=>{
        const file=`part-${i}.txt`;
        const claim=fervo(clone,'claim','--parent','n_0','--scope',file,'--intent',`add ${file}`,'--key','claim','--checkout');
        writeFileSync(join(claim.worktree,file),`${i}\n`);command(claim.worktree,'git','add',file);command(claim.worktree,'git','commit','-qm',`add ${file}`);
        return fervo(claim.worktree,'submit','--lease',claim.lease,'--key','submit');
      });
      await drain();
      const stale=fervo(agents[2]!,'claim','--parent','n_0','--scope','part-2.txt','--intent','add part-2.txt','--key','claim');
      const db=new Database(join(root,'.fervo','fervo.db'));db.prepare('UPDATE claims SET expires_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),stale.lease);db.close();
      const events=asHuman('events').split('\n').map(line=>JSON.parse(line) as {type:string;subject:string;data:Record<string,unknown>});
      const of=(type:string)=>events.filter(e=>e.type===type);
      assert.equal(of('claim_created').length,3);
      assert.deepEqual(of('node_submitted').map(e=>e.subject).sort(),submitted.map(s=>s.node).sort());
      assert.equal(of('node_merged').length,1);
      assert.deepEqual(of('needs_rebase').map(e=>e.subject),submitted.map(s=>s.node).filter(node=>node!==of('node_merged')[0]!.subject));
      assert.deepEqual(of('claim_expired').map(e=>e.subject),[stale.lease]);
      assert.ok(of('node_state').some(e=>e.data.state==='verified'));
    } finally {server.kill();}
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
