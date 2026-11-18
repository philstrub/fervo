/**
# Command Timeout Tests

A command's timeout and exit stop everything it started, not only its shell.

## 1. What This Module Does
Runs baseline jobs whose metric command forks: one that outlives its timeout, and one that leaves a child
in the background holding its output. Both must finish promptly, the first with a timeout error. Then a
`fervo runner` process gets SIGTERM while a command runs, and the command's children must die with it.
## 2. Why This Module Exists
The runner killed only the shell: a forked child kept the output pipe open, so a looping test hung its
job, with the lease renewed by the heartbeat, until the child exited.
## 3. How It Fits in the Architecture
Calls `executeJob` on a mirror, as `runner-extensions.test.ts` does, and runs the CLI for the signal case.
## 4. Key Concepts
Each command sleeps for a unique number of seconds so `pgrep` finds exactly its own children.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { executeJob } from '../src/runner/run.js';
import { loadRunnerExtensions } from '../src/runner/extensions.js';

const cli=resolve('dist/src/cli/main.js');
function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const alive=(seconds:number)=>spawnSync('pgrep',['-f',`sleep ${seconds}`]).status===0;
const until=async(what:string,check:()=>boolean,ms:number)=>{for(const end=Date.now()+ms;!check();await new Promise(done=>setTimeout(done,50)))if(Date.now()>end)throw new Error(`timed out waiting for ${what}`);};

test('a timeout or exit kills the command\'s whole process group, and so does the runner\'s SIGTERM',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-timeout-'));
  const tag=1000+Math.floor(Math.random()*8000);
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    const commit=(cmd:string)=>{writeFileSync(join(source,'fervo.toml'),`[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="${cmd}"\ndirection="max"\nweight=1\ntimeout="1s"\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n`);git(source,'add','.');git(source,'commit','-qm',cmd);return git(source,'rev-parse','HEAD');};
    const mirror=join(tmp,'mirror.git');const extensions=await loadRunnerExtensions({extensions:[],disable:[]},tmp);
    const baseline=async(cmd:string)=>{
      const sha=commit(cmd);rmSync(mirror,{recursive:true,force:true});git(tmp,'clone','--mirror','-q',source,mirror);
      const started=Date.now();
      const result=await executeJob({id:'j_1',kind:'baseline',node:null,state:'running',commit:sha,parent_commit:null,intent:null,scope:null,author:null,author_provider:null,baselines:{}},mirror,{},extensions).then(r=>r.verdicts.map(v=>v.samples),(error:Error)=>error.message);
      return {result,ms:Date.now()-started};
    };

    const hung=await baseline(`sleep ${tag}; echo 5`);
    assert.match(String(hung.result),/^command timed out after 1s/,'the metric fails with a timeout');
    assert.ok(hung.ms<5000,`finished in ${hung.ms} ms, not after the child's ${tag} s`);
    assert.equal(alive(tag),false,'the forked sleep was killed');

    const background=await baseline(`sleep ${tag+1} & echo 5`);
    assert.deepEqual(background.result,[[5,5,5,5,5]],'a child left in the background does not hold the job');
    assert.ok(background.ms<5000,`finished in ${background.ms} ms`);
    assert.equal(alive(tag+1),false,'and is killed when the command exits');

    writeFileSync(join(source,'fervo.toml'),`[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="sleep ${tag+2}; echo 5"\ndirection="max"\nweight=1\ntimeout="5m"\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n`);git(source,'commit','-qam','long timeout');
    const root=join(tmp,'root');const init=spawnSync(process.execPath,[cli,'init','--source',source,'--root',root,'--actor','operator'],{encoding:'utf8'});assert.equal(init.status,0,init.stderr);
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    try{
      let log='';await new Promise<void>((done,reject)=>{server.stderr.on('data',(data:Buffer)=>{log+=data.toString();if(log.includes('listening'))done();});server.on('exit',code=>reject(new Error(`server exited ${code}: ${log}`)));});
      const url=`http://127.0.0.1:${port}`;const human=join(tmp,'human');
      const clone=spawnSync(process.execPath,[cli,'clone',url,human,'--token',JSON.parse(init.stdout).token],{encoding:'utf8'});assert.equal(clone.status,0,clone.stderr);
      const added=spawnSync(process.execPath,[cli,'actor','add','runner-1','--kind','runner','--key','add-runner'],{cwd:human,encoding:'utf8',env:{...process.env,FERVO_TOKEN:JSON.parse(init.stdout).token}});assert.equal(added.status,0,added.stderr);
      const runner=spawn(process.execPath,[cli,'runner','--remote',url],{env:{...process.env,FERVO_TOKEN:JSON.parse(added.stdout).token},stdio:['ignore','ignore','pipe']});
      let runnerLog='';runner.stderr.on('data',(data:Buffer)=>{runnerLog+=data.toString();});
      await until('the baseline command to start',()=>alive(tag+2),20_000);
      const exited=new Promise<number|null>(done=>runner.on('exit',code=>done(code)));
      runner.kill('SIGTERM');
      assert.equal(await exited,143,`the runner exits as a shell reports SIGTERM: ${runnerLog}`);
      assert.match(runnerLog,/runner SIGTERM: killed 1 running command\(s\)/);
      await until('the command to die',()=>!alive(tag+2),5000);
    }finally{server.kill('SIGTERM');await new Promise(done=>server.on('close',done));}
  }finally{rmSync(tmp,{recursive:true,force:true});for(const n of [tag,tag+1,tag+2])spawnSync('pkill',['-f',`sleep ${n}`]);}
});
