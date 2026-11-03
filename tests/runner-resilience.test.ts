/**
# Runner Resilience Tests

The runner keeps a job when the connection drops after the server applied a request.

## 1. What This Module Does
Puts a proxy between runner and server that swallows the first lease and result responses.
## 2. Why This Module Exists
A lease aborted by the client timeout used to end the runner and strand a leased job.
## 3. How It Fits in the Architecture
Exercises the runner's retries against the server's idempotency replay over real HTTP.
## 4. Key Concepts
A retry reuses the idempotency key, so the server returns the stored response instead of acting twice.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runRunner } from '../src/runner/run.js';

const cli=resolve('dist/src/cli/main.js');
function run(cwd:string,env:NodeJS.ProcessEnv,bin:string,...args:string[]):string {const r=spawnSync(bin,args,{cwd,env,encoding:'utf8'});assert.equal(r.status,0,`${bin} ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function command(cwd:string,bin:string,...args:string[]):string {return run(cwd,process.env,bin,...args);}
function fervo(cwd:string,...args:string[]):any{return JSON.parse(command(cwd,process.execPath,cli,...args));}

test('runner retries a lease and a result whose responses were lost without leasing twice',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-resilience-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);
    command(source,'git','init','-q','-b','main');command(source,'git','config','user.email','test@example.com');command(source,'git','config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),`[goal]\ntext = "Raise the score"\n[tests]\ncmd = "test -f score.txt"\n[[metrics]]\nname = "score"\ncmd = "cat score.txt"\ndirection = "max"\nweight = 1\n[eval]\nsamples = 3\nbaseline_samples = 5\n[pinned]\npaths = ["fervo.toml"]\n[merge.main]\nrequire = ["tests"]\n`);
    writeFileSync(join(source,'score.txt'),'10\n');command(source,'git','add','.');command(source,'git','commit','-qm','baseline');
    const root=join(tmp,'manager');const init=fervo(tmp,'init','--source',source,'--root',root,'--actor','operator');
    const probe=createNetServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address!=='string');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    await new Promise<void>((resolve,reject)=>{server.stderr.on('data',(data:Buffer)=>{if(data.toString().includes('listening'))resolve();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    // Forwards everything, but for the first lease and the first result it waits for the server's answer and then drops the connection.
    // It runs in its own process because the runner clones with a synchronous git call that would block an in-process proxy.
    const proxySource=`const http=require('node:http');const dropped={lease:0,result:0};
      const proxy=http.createServer((req,res)=>{
        const kind=req.method==='POST'&&req.url==='/jobs/lease'?'lease':req.method==='POST'&&/^\\/jobs\\/[^/]+\\/result$/.test(req.url)?'result':null;
        const upstream=http.request({host:'127.0.0.1',port:${port},method:req.method,path:req.url,headers:req.headers},response=>{
          if(kind&&dropped[kind]===0){dropped[kind]++;console.log('dropped '+kind);response.resume();response.on('end',()=>req.socket.destroy());return;}
          res.writeHead(response.statusCode,response.headers);response.pipe(res);
        });
        req.pipe(upstream);
      });
      proxy.listen(0,'127.0.0.1',()=>console.log('listening '+proxy.address().port));`;
    const proxy=spawn(process.execPath,['-e',proxySource],{stdio:['ignore','pipe','inherit']});
    const dropped:string[]=[];
    const proxyPort=await new Promise<number>((resolve,reject)=>{proxy.stdout.on('data',(data:Buffer)=>{for(const line of data.toString().split('\n')){const listening=/^listening (\d+)$/.exec(line);if(listening)resolve(Number(listening[1]));else if(line.startsWith('dropped '))dropped.push(line.slice(8));}});proxy.on('exit',code=>reject(new Error(`proxy exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const human=join(tmp,'human');fervo(tmp,'clone',url,human,'--token',init.token);
      const asHuman=(...args:string[])=>JSON.parse(run(human,{...process.env,FERVO_TOKEN:init.token},process.execPath,cli,...args));
      const runner=asHuman('actor','add','runner','--kind','runner','--key','add-runner');
      const settings={anthropicModel:'fake',openaiModel:'fake',reviewProvider:'anthropic',reviewModel:'fake',judgeTemplate:'Compare the change',reviewTemplate:'Review the change'};
      const model=async()=>({passed:true,evidence:'unused'});
      await runRunner(`http://127.0.0.1:${proxyPort}`,runner.token,settings,model,true);
      assert.deepEqual(dropped,['lease','result']);
      const events=run(human,{...process.env,FERVO_TOKEN:init.token},process.execPath,cli,'events').split('\n').map(line=>JSON.parse(line));
      assert.equal(events.filter(e=>e.type==='job_leased').length,1);
      assert.equal(events.filter(e=>e.type==='job_done').length,1);
    } finally {proxy.kill();server.kill();}
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
