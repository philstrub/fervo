/**
# Evaluation Runner

The operator-side executor of tests, metrics, and model reviews.

## 1. What This Module Does
Leases jobs, checks commits out in worktrees, runs the producer registered for each job's kind, and posts
its verdicts.
## 2. Why This Module Exists
The server has no model keys and does not execute agent-authored code.
## 3. How It Fits in the Architecture
The runner is an authenticated API client with read-only Git access.
## 4. Key Concepts
All commands and rubrics come from operator-controlled main. Every command a producer runs has the
runner's secrets removed from its environment, then passes through the registered `exec` rewrites.
## 5. Process Groups
Each command runs in its own process group, killed whole on timeout and once its shell exits: a child the
command forked (a test runner's workers, a server left in the background) would otherwise outlive the
timeout and hold the output pipe open, so the job never finished. A group does not get the terminal's
Ctrl-C, so the runner kills the live groups when it gets SIGINT or SIGTERM, then exits with 128 plus the
signal's number, as a shell reports it.
*/
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse } from 'smol-toml';
import { Config, duration } from '../config.js';
import { Job, LeaseJob, JobResult, Whoami } from '../models.js';
import { request } from '../remote.js';
import type { Remote } from '../models.js';
import { modelChain, type CommandRewrite, type RunnerExtensions } from './extensions.js';
import type { RunnerSettings } from './producers.js';

function git(cwd:string,...args:string[]):string {const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0)throw new Error(`git ${args[0]}: ${r.stderr}`);return r.stdout.trimEnd();}
const groups=new Set<number>();
// ESRCH: nothing is left in the group. EPERM: on macOS, everything left is a zombie.
function killGroup(pid:number):void {try{process.kill(-pid,'SIGKILL');}catch(error){if(!['ESRCH','EPERM'].includes((error as NodeJS.ErrnoException).code!))throw error;}}
async function run(command:string,cwd:string,timeout:string,rewrites:CommandRewrite[]):Promise<string> {
  const env={...process.env};delete env.FERVO_TOKEN;delete env.OPENAI_API_KEY;delete env.ANTHROPIC_API_KEY;
  const spec=rewrites.reduce((spec,rewrite)=>rewrite(spec),{command,cwd,env,timeout:duration(timeout)});
  const child=spawn('sh',['-c',spec.command],{cwd:spec.cwd,env:spec.env,stdio:['ignore','pipe','pipe'],detached:true});
  const pid=child.pid!;groups.add(pid);
  let stdout='';let stderr='';let timedOut=false;
  child.stdout.on('data',(data:Buffer)=>{stdout=(stdout+data.toString()).slice(-10000);});
  child.stderr.on('data',(data:Buffer)=>{stderr=(stderr+data.toString()).slice(-10000);});
  child.on('exit',()=>killGroup(pid));
  const timer=setTimeout(()=>{timedOut=true;killGroup(pid);},spec.timeout*1000);
  try {return await new Promise<string>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(stdout.trimEnd()):reject(new Error(timedOut?`command timed out after ${spec.timeout}s: ${stderr||stdout}`:`command failed (${code}): ${stderr||stdout}`)));});}
  finally {clearTimeout(timer);groups.delete(pid);}
}

export async function executeJob(job: typeof LeaseJob._output, mirror:string, settings:RunnerSettings, extensions:RunnerExtensions):Promise<typeof JobResult._output> {
  git(mirror,'fetch','--quiet','origin','+refs/heads/main:refs/heads/main','+refs/fervo/nodes/*:refs/fervo/nodes/*');
  const config=Config.parse(parse(git(mirror,'show','refs/heads/main:fervo.toml')));
  const produce=extensions.producers[job.kind];
  if(!produce)throw new Error(`no producer for job kind ${job.kind} (registered: ${Object.keys(extensions.producers).join(', ')})`);
  const nodeDir=mkdtempSync(join(tmpdir(),'fervo-node-'));
  const parentDir=mkdtempSync(join(tmpdir(),'fervo-parent-'));
  rmSync(nodeDir,{recursive:true});rmSync(parentDir,{recursive:true});
  git(mirror,'worktree','add','--quiet','--detach',nodeDir,job.commit!);
  if(job.parent_commit)git(mirror,'worktree','add','--quiet','--detach',parentDir,job.parent_commit);
  const chain=modelChain(extensions);
  try {
    return {verdicts:await produce(job,{config,settings,node:nodeDir,parent:job.parent_commit?parentDir:null,
      diff:()=>git(mirror,'diff',job.parent_commit!,job.commit!,'--').slice(0,20000),
      run:(command,cwd,timeout)=>run(command,cwd,timeout,extensions.rewrites),
      model:async(provider,model,prompt)=>(await chain({provider,model,prompt,job})).decision})};
  } finally {git(mirror,'worktree','remove','--force',nodeDir);if(job.parent_commit)git(mirror,'worktree','remove','--force',parentDir);}
}

const log=(message:string)=>process.stderr.write(`${new Date().toISOString()} ${message}\n`);
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
// An HTTP 4xx is the server refusing the request; anything else (abort, reset, 5xx) may succeed on a retry.
const transient=(error:unknown)=>!(error instanceof Error&&/^HTTP 4\d\d:/.test(error.message));
const message=(error:unknown)=>error instanceof Error?error.message:String(error);

// Retries with the same idempotency key, so a request the server applied but whose response was lost replays its stored response.
async function retrying<T>(what:string,attempts:number,call:()=>Promise<T>):Promise<T> {
  for(let attempt=1,delay=1000;;attempt++,delay=Math.min(delay*2,30_000)) {
    try {return await call();}
    catch(error){if(!transient(error)||attempt>=attempts)throw error;log(`${what} error: ${message(error)}; retry in ${delay/1000}s`);await sleep(delay);}
  }
}

export async function runRunner(url:string,token:string,settings:RunnerSettings,extensions:RunnerExtensions,once=false):Promise<void> {
  const remote:Remote={url,auth:`Bearer ${token}`};const who=await retrying('whoami',once?5:Infinity,()=>request(remote,'GET','/whoami',Whoami));if(who.actor.kind!=='runner')throw new Error('runner token required');
  const root=mkdtempSync(join(tmpdir(),'fervo-runner-'));const mirror=join(root,'repo.git');
  git(root,'clone','--mirror','--quiet','-c',`http.${who.git_url}.extraHeader=Authorization: Bearer ${token}`,who.git_url,mirror);
  const die=(signal:NodeJS.Signals)=>{for(const pid of groups)killGroup(pid);log(`runner ${signal}: killed ${groups.size} running command(s)`);process.exit(128+constants.signals[signal]);};
  process.once('SIGINT',die);process.once('SIGTERM',die);
  try {do {
    // The lease waits up to 30 s on the server, so the client allows 50 s before aborting.
    const leaseKey=randomUUID();
    const job=await retrying('lease',once?5:Infinity,()=>request(remote,'POST','/jobs/lease',LeaseJob.nullable(),{key:leaseKey,body:{wait:once?0:30},timeoutMs:50_000}));
    if(!job){if(once)return;continue;}
    const heartbeat=setInterval(()=>{void request(remote,'POST',`/jobs/${job.id}/heartbeat`,Job,{key:randomUUID(),body:{}}).catch(error=>log(`heartbeat ${job.id} error: ${message(error)}`));},30_000);
    let result:typeof JobResult._output;
    try{result=await executeJob(job,mirror,settings,extensions);}catch(error){result={verdicts:[],error:message(error)};}finally{clearInterval(heartbeat);}
    const resultKey=randomUUID();
    try{await retrying(`result ${job.id}`,5,()=>request(remote,'POST',`/jobs/${job.id}/result`,Job,{key:resultKey,body:result}));}
    catch(error){if(once)throw error;log(`result ${job.id} dropped: ${message(error)}`);}
  } while(!once);} finally{process.off('SIGINT',die);process.off('SIGTERM',die);rmSync(root,{recursive:true,force:true});}
}

export function readSettings(flags:RunnerSettings):RunnerSettings{const read=(file?:string)=>file===undefined?undefined:readFileSync(file,'utf8');return {...flags,judgeTemplate:read(flags.judgeTemplate),reviewTemplate:read(flags.reviewTemplate)};}
