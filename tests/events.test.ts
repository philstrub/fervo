/**
# Event Log Reads

The operator's view of everything the server records.

## 1. What This Module Does
Initializes a managed repository, performs a few writes, and reads them back through `GET /events` and `fervo events`.
## 2. Why This Module Exists
The events table had writers but no reader; a demo or an operator needs to watch claims, submits, verdicts and merges as they happen.
## 3. How It Fits in the Architecture
Runs the built CLI against a served managed repository, without model network calls.
## 4. Key Concepts
Events are returned in sequence order after a cursor; the cursor makes `--follow` a plain poll with no duplicates.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli=resolve('dist/src/cli/main.js');
function run(cwd:string,env:NodeJS.ProcessEnv,...args:string[]):string {const r=spawnSync(process.execPath,[cli,...args],{cwd,env,encoding:'utf8'});assert.equal(r.status,0,`fervo ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function git(cwd:string,...args:string[]):void {const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}

test('events returns the log after a cursor, in order, to humans only, and the CLI prints one JSON line each',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-events-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');const init=JSON.parse(run(tmp,process.env,'init','--source',source,'--root',root,'--actor','operator'));
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    await new Promise<void>((done,reject)=>{server.stderr.on('data',(data:Buffer)=>{if(data.toString().includes('listening'))done();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const human=join(tmp,'human');run(tmp,process.env,'clone',url,human,'--token',init.token);
      const env={...process.env,FERVO_TOKEN:init.token};
      const agent=JSON.parse(run(human,env,'actor','add','agent-1','--kind','agent','--provider','openai','--model','test','--harness','script','--key','add-agent'));
      const claim=await fetch(`${url}/claims`,{method:'POST',headers:{Authorization:`Bearer ${agent.token}`,'Idempotency-Key':'claim-1','Content-Type':'application/json'},body:JSON.stringify({parent:'n_0',scope:['score.txt'],intent:'improve score'})});
      assert.equal(claim.status,200);
      const all=await (await fetch(`${url}/events`,{headers:{Authorization:`Bearer ${init.token}`}})).json() as {seq:number;actor:string;type:string;subject:string;data:Record<string,unknown>}[];
      assert.deepEqual(all.map(e=>e.type),['initialized','actor_created','actor_created','claim_created'],'init, the clone\'s enroller, the agent, the claim');
      assert.ok(all.every((e,i)=>i===0||e.seq>all[i-1]!.seq),'ascending seq');
      const claimed=all[3]!;assert.equal(claimed.actor,'agent-1');assert.deepEqual(claimed.data,{overlaps:[]});
      const rest=await (await fetch(`${url}/events?after=${all[2]!.seq}`,{headers:{Authorization:`Bearer ${init.token}`}})).json() as {seq:number}[];
      assert.deepEqual(rest.map(e=>e.seq),[claimed.seq]);
      assert.deepEqual(await (await fetch(`${url}/events?after=${claimed.seq}`,{headers:{Authorization:`Bearer ${init.token}`}})).json(),[]);
      const denied=await fetch(`${url}/events`,{headers:{Authorization:`Bearer ${agent.token}`}});
      assert.equal(denied.status,400);assert.match(await denied.text(),/human token required/);
      const lines=run(human,env,'events','--after',String(all[0]!.seq)).split('\n').map(line=>JSON.parse(line));
      assert.deepEqual(lines.map(e=>e.type),['actor_created','actor_created','claim_created']);
    } finally { server.kill(); }
  } finally { rmSync(tmp,{recursive:true,force:true}); }
});
