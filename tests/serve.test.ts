/**
# Serving Behind a Proxy

`fervo serve` works under a URL other than its listen address and shuts down without cutting requests.

## 1. What This Module Does
Serves a managed repository behind a TCP forwarder named by `--public-url`, clones and fetches through it,
checks `/healthz`, the 1 MB body limit, the loopback rule and a SIGTERM during a long poll.
## 2. Why This Module Exists
Clone URLs used to come from the client's `Host` header with a hard-coded `http://`, so a client behind a
TLS proxy was handed a URL it could not use, and any client could choose the URL it was handed.
## 3. How It Fits in the Architecture
Runs the built CLI as separate processes; the forwarder stands in for a reverse proxy.
## 4. Key Concepts
The forwarder runs in its own process because the test blocks its event loop on synchronous Git calls.
Those calls can outlast the server's keep-alive, so HTTP checks run before them or after a loop turn.
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
function git(cwd:string,...args:string[]):string {const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('serve hands out its public URL, answers health checks, caps bodies and drains on SIGTERM',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-serve-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');const init=JSON.parse(run(tmp,process.env,'init','--source',source,'--root',root,'--actor','operator'));
    const refused=spawnSync(process.execPath,[cli,'serve','--root',root,'--host','0.0.0.0'],{encoding:'utf8'});
    assert.notEqual(refused.status,0);assert.match(refused.stderr,/--public-url is required when --host is not loopback/);
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const forwarder=spawn(process.execPath,['-e',`const net=require('node:net');const s=net.createServer(c=>{const u=net.connect(${port},'127.0.0.1');c.pipe(u);u.pipe(c);c.on('error',()=>u.destroy());u.on('error',()=>c.destroy());});s.listen(0,'127.0.0.1',()=>console.log('listening '+s.address().port));`],{stdio:['ignore','pipe','inherit']});
    const proxyPort=await new Promise<number>((done,reject)=>{forwarder.stdout.on('data',(data:Buffer)=>{const m=/listening (\d+)/.exec(data.toString());if(m)done(Number(m[1]));});forwarder.on('exit',code=>reject(new Error(`forwarder exited ${code}`)));});
    const publicUrl=`http://127.0.0.1:${proxyPort}`;
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port),'--public-url',`${publicUrl}/`],{stdio:['ignore','ignore','pipe']});
    let log='';
    await new Promise<void>((done,reject)=>{server.stderr.on('data',(data:Buffer)=>{log+=data.toString();if(log.includes('listening'))done();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    const exited=new Promise<number|null>(done=>server.on('close',code=>done(code)));  // 'close' waits for stderr to drain; 'exit' may not
    try {
      const direct=`http://127.0.0.1:${port}`;
      const health=await fetch(`${direct}/healthz`);assert.equal(health.status,200);assert.deepEqual(await health.json(),{});
      const who=await (await fetch(`${direct}/whoami`,{headers:{Authorization:`Bearer ${init.token}`}})).json() as {git_url:string};
      assert.equal(who.git_url,`${publicUrl}/git/repo.git`,'the public URL, not the address the request came in on');
      const large=await fetch(`${direct}/claims`,{method:'POST',headers:{Authorization:`Bearer ${init.token}`,'Idempotency-Key':'large','Content-Type':'application/json'},body:JSON.stringify({parent:'n_0',scope:['x'],intent:'x'.repeat(1_100_000)})});
      assert.equal(large.status,413);
      const human=join(tmp,'human');run(tmp,process.env,'clone',publicUrl,human,'--token',init.token);
      const agent=JSON.parse(run(human,{...process.env,FERVO_TOKEN:init.token},'actor','add','agent-1','--kind','agent','--provider','openai','--model','test','--harness','script','--key','add-agent'));
      const clone=join(tmp,'agent');run(tmp,process.env,'clone',publicUrl,clone,'--token',agent.token);
      assert.equal(git(clone,'remote','get-url','origin'),`${publicUrl}/git/repo.git`);
      git(clone,'fetch','--quiet','origin');
      assert.equal(JSON.parse(run(clone,process.env,'context')).main.node,'n_0');
      // The synchronous calls above can outlast the server's 5 s keep-alive; one loop turn lets fetch drop the sockets it closed.
      await new Promise(done=>setTimeout(done,50));
      const started=Date.now();
      const poll=fetch(`${direct}/status/n_0?wait=2`,{headers:{Authorization:`Bearer ${agent.token}`}});
      await new Promise(done=>setTimeout(done,300));
      server.kill('SIGTERM');
      const answered=await poll;assert.equal(answered.status,200,'the open long poll finishes');assert.ok(Date.now()-started>=2000);
      assert.equal(await exited,0);assert.ok(Date.now()-started<4000,`exit took ${Date.now()-started} ms`);
      assert.match(log,/\[serve\] SIGTERM: finishing open requests\n\[serve\] closed\n/);
    } finally { server.kill();forwarder.kill(); }
  } finally { rmSync(tmp,{recursive:true,force:true}); }
});
