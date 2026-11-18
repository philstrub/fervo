/**
# HTTP Status Tests

Each kind of refusal reaches the client with its own status, and a server fault is a 500.

## 1. What This Module Does
Serves a managed repository and calls representative routes with the wrong token, the wrong object,
the wrong state and a broken repository.
## 2. Why This Module Exists
Every exception used to be a 400, so the runner, which retries only non-4xx answers, dropped job
results when the server itself had failed.
## 3. How It Fits in the Architecture
Talks to `fervo serve` over real HTTP, as the CLI and the runner do.
## 4. Key Concepts
The server fault is made by moving the bare repository away while the server runs; the boundary
logs it with `[handler]` and its stack.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli=resolve('dist/src/cli/main.js');
function run(cwd:string,env:NodeJS.ProcessEnv,...args:string[]):string {const r=spawnSync(process.execPath,[cli,...args],{cwd,env,encoding:'utf8'});assert.equal(r.status,0,`fervo ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function git(cwd:string,...args:string[]):void {const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}

test('refusals carry 400, 401, 403, 404 and 409, and a server fault is a logged 500',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-status-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');const init=JSON.parse(run(tmp,process.env,'init','--source',source,'--root',root,'--actor','operator'));
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    let log='';
    await new Promise<void>((done,reject)=>{server.stderr.on('data',(data:Buffer)=>{log+=data.toString();if(log.includes('listening'))done();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const human=join(tmp,'human');run(tmp,process.env,'clone',url,human,'--token',init.token);
      const agent=JSON.parse(run(human,{...process.env,FERVO_TOKEN:init.token},'actor','add','agent-1','--kind','agent','--provider','openai','--model','test','--harness','script','--key','add-agent'));
      const call=async(token:string|null,method:string,path:string,key?:string,body?:unknown)=>{const r=await fetch(`${url}${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}),...(key?{'Idempotency-Key':key,'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,error:(await r.json() as {error?:string}).error};};
      assert.deepEqual(await call(null,'GET','/whoami'),{status:401,error:'Bearer token required'});
      assert.deepEqual(await call(agent.token,'GET','/events'),{status:403,error:'human token required'});
      assert.deepEqual(await call(agent.token,'POST','/baseline','agent-baseline',{}),{status:403,error:'human token required'});
      assert.deepEqual(await call(agent.token,'GET','/status/n_missing'),{status:404,error:'object not found'});
      assert.deepEqual(await call(agent.token,'GET','/nowhere'),{status:404,error:'unknown route'});
      assert.equal((await call(agent.token,'POST','/claims','bad-claim',{parent:'n_0',scope:[],intent:'x'})).status,400,'schema violation');
      assert.equal((await call(agent.token,'POST','/claims','no-body')).status,400,'missing fields');
      assert.equal((await call(init.token,'POST','/actors','dup-agent',{id:'agent-1',kind:'agent',provider:null,model:null,harness:null})).status,409,'existing actor id');
      assert.equal((await call(agent.token,'POST','/claims','claim-1',{parent:'n_0',scope:['score.txt'],intent:'raise'})).status,200);
      assert.deepEqual(await call(agent.token,'POST','/claims','claim-1',{parent:'n_0',scope:['score.txt'],intent:'other'}),{status:409,error:'idempotency key reused with a different request'});
      assert.deepEqual(await call(init.token,'POST','/nodes/n_0/merge','merge-root',{reason:'again'}),{status:409,error:'node must be verified'});
      renameSync(join(root,'repo.git'),join(root,'moved.git'));
      const fault=await call(agent.token,'GET','/context');
      renameSync(join(root,'moved.git'),join(root,'repo.git'));
      assert.equal(fault.status,500);assert.match(fault.error!,/fervo\.toml/);
      assert.match(log,/\[handler\] GET \/context: Error: main must contain a valid fervo\.toml/);
      assert.equal((await call(agent.token,'GET','/context')).status,200,'the fault was the moved repository, not the server');
    } finally { server.kill(); }
  } finally { rmSync(tmp,{recursive:true,force:true}); }
});
