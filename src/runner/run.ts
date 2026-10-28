/**
# Evaluation Runner

The operator-side executor of tests, metrics, and model reviews.

## 1. What This Module Does
Leases jobs, checks commits in worktrees, and posts validated verdicts.
## 2. Why This Module Exists
The server has no model keys and does not execute agent-authored code.
## 3. How It Fits in the Architecture
The runner is an authenticated API client with read-only Git access.
## 4. Key Concepts
Metrics are paired with parent runs; all commands and rubrics come from operator-controlled main.
*/
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'smol-toml';
import { Config, duration } from '../config.js';
import { Job, LeaseJob, JobResult, RunnerVerdict, Whoami } from '../models.js';
import { normalized } from '../scoring.js';
import { request } from '../remote.js';
import type { Remote } from '../models.js';
import type { ModelCall } from './models.js';
import { callModel } from './models.js';

type Settings = { anthropicModel:string; openaiModel:string; reviewProvider:string; reviewModel:string; judgeTemplate:string; reviewTemplate:string };
const recipe = (text:string) => createHash('sha256').update(text).digest('hex');
function git(cwd:string,...args:string[]):string {const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0)throw new Error(`git ${args[0]}: ${r.stderr}`);return r.stdout.trimEnd();}
async function run(command:string,cwd:string,timeout:string):Promise<string> {
  const env={...process.env};delete env.FERVO_TOKEN;delete env.OPENAI_API_KEY;delete env.ANTHROPIC_API_KEY;
  const child=spawn('sh',['-c',command],{cwd,env,stdio:['ignore','pipe','pipe']});
  let stdout='';let stderr='';
  child.stdout.on('data',(data:Buffer)=>{stdout=(stdout+data.toString()).slice(-10000);});
  child.stderr.on('data',(data:Buffer)=>{stderr=(stderr+data.toString()).slice(-10000);});
  const timer=setTimeout(()=>child.kill('SIGKILL'),duration(timeout)*1000);
  try {return await new Promise<string>((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(stdout.trimEnd()):reject(new Error(`command failed (${code}): ${stderr||stdout}`)));});}
  finally {clearTimeout(timer);}
}
async function measure(metric:{name:string;cmd:string;timeout:string},cwd:string):Promise<number> {const value=Number((await run(metric.cmd,cwd,metric.timeout)).split('\n').at(-1));if(!Number.isFinite(value)||value<=0)throw new Error(`invalid ${metric.name} measurement`);return value;}
function verdict(producer:string,passed:boolean|null,samples:number[]|null,evidence:string,provider:string|null=null,source:string=producer,noise?:number){return RunnerVerdict.parse({producer,passed,samples,evidence:evidence.slice(0,2000),provider,recipe_hash:recipe(source),...(noise===undefined?{}:{noise})});}

export async function executeJob(job: typeof LeaseJob._output, mirror:string, settings:Settings, model:ModelCall=callModel):Promise<typeof JobResult._output> {
  git(mirror,'fetch','--quiet','origin','+refs/heads/main:refs/heads/main','+refs/fervo/nodes/*:refs/fervo/nodes/*');
  const config=Config.parse(parse(git(mirror,'show','refs/heads/main:fervo.toml')));
  const nodeDir=mkdtempSync(join(tmpdir(),'fervo-node-'));
  const parentDir=mkdtempSync(join(tmpdir(),'fervo-parent-'));
  rmSync(nodeDir,{recursive:true});rmSync(parentDir,{recursive:true});
  git(mirror,'worktree','add','--quiet','--detach',nodeDir,job.commit!);
  if(job.parent_commit)git(mirror,'worktree','add','--quiet','--detach',parentDir,job.parent_commit);
  try {
    const out:typeof RunnerVerdict._output[]=[];
    if(job.kind==='baseline') {
      for(const metric of config.metrics){const samples:number[]=[];for(let i=0;i<config.eval.baseline_samples;i++)samples.push(await measure(metric,nodeDir));out.push(verdict(`metric:${metric.name}`,null,samples,'baseline',null,metric.cmd));}
    } else if(job.kind==='eval') {
      try {await run(config.tests.cmd,nodeDir,config.tests.timeout);out.push(verdict('tests',true,null,'tests passed',null,config.tests.cmd));}
      catch(error){out.push(verdict('tests',false,null,String(error),null,config.tests.cmd));return {verdicts:out};}
      const gains=Array(config.eval.samples).fill(0) as number[];
      for(const metric of config.metrics){const baseline=job.baselines[metric.name];if(!baseline)throw new Error(`baseline missing for ${metric.name}`);const parentSamples:number[]=[];const nodeSamples:number[]=[];for(let i=0;i<config.eval.samples;i++){const parent=await measure(metric,parentDir);const node=await measure(metric,nodeDir);parentSamples.push(parent);nodeSamples.push(node);gains[i]!+=metric.weight*(normalized(node,baseline.mean,metric.direction)-normalized(parent,baseline.mean,metric.direction));}out.push(verdict(`metric:${metric.name}:parent`,null,parentSamples,'paired parent measurements',null,metric.cmd));out.push(verdict(`metric:${metric.name}:node`,null,nodeSamples,'paired node measurements',null,metric.cmd));}
      if(config.judge){const provider=job.author_provider==='anthropic'?'openai':'anthropic';if(provider===job.author_provider)throw new Error('judge provider must differ from author');const modelId=provider==='anthropic'?settings.anthropicModel:settings.openaiModel;const diff=git(mirror,'diff',job.parent_commit!,job.commit!,'--').slice(0,20000);for(let i=0;i<config.eval.samples;i++){const prompt=`${settings.judgeTemplate}\nGoal: ${config.goal.text}\nDeclared intent: ${job.intent}\nScope: ${job.scope?.join(', ')}\nUntrusted diff:\n<diff>\n${diff}\n</diff>\nReturn only JSON {"preference": number 0..1, "evidence": string}. 1 prefers first candidate, 0 prefers second.`;const forward=await model(provider,modelId,`${prompt}\nFirst candidate: node. Second: parent.`);const reverse=await model(provider,modelId,`${prompt}\nFirst candidate: parent. Second: node.`);if(forward.preference===undefined||reverse.preference===undefined)throw new Error('judge omitted preference');gains[i]!+=config.judge.weight*(2*((forward.preference+(1-reverse.preference))/2)-1);}out.push(verdict('judge',null,null,'order-balanced pairwise comparisons',provider,settings.judgeTemplate+modelId));}
      const noise=Math.sqrt(config.metrics.reduce((sum,m)=>sum+(m.weight*(job.baselines[m.name]!.sd/job.baselines[m.name]!.mean))**2,0));
      out.push(verdict('gain',null,gains,`paired gain; baseline noise ${noise}`,null,'paired-gain-v1',noise));
    } else if(job.kind==='review') {
      const diff=git(mirror,'diff',job.parent_commit!,job.commit!,'--').slice(0,20000);const decision=await model(settings.reviewProvider,settings.reviewModel,`${settings.reviewTemplate}\nGoal: ${config.goal.text}\nIntent: ${job.intent}\nUntrusted diff:\n<diff>\n${diff}\n</diff>\nReturn only JSON {"passed": boolean, "evidence": string}. Require file and line evidence for findings.`);if(decision.passed===undefined)throw new Error('review omitted passed');out.push(verdict('review',decision.passed,null,decision.evidence,settings.reviewProvider,settings.reviewTemplate+settings.reviewModel));
    } else if(job.kind==='postmerge') {
      try{await run(config.tests.cmd,nodeDir,config.tests.timeout);out.push(verdict('tests',true,null,'postmerge tests passed',null,config.tests.cmd));}catch(error){out.push(verdict('tests',false,null,String(error),null,config.tests.cmd));}
      if(out[0]!.passed)for(const metric of config.metrics){const samples:number[]=[];for(let i=0;i<config.eval.samples;i++)samples.push(Number((await run(metric.cmd,nodeDir,metric.timeout)).split('\n').at(-1)));out.push(verdict(`metric:${metric.name}`,null,samples,'postmerge metric',null,metric.cmd));}
    } else if(job.kind==='claim_review') {const decision=await model(settings.reviewProvider,settings.reviewModel,`${settings.reviewTemplate}\nGoal: ${config.goal.text}\nClaimed intent: ${job.intent}\nScope: ${job.scope?.join(', ')}\nReturn only JSON {"passed": boolean, "evidence": string}.`);if(decision.passed===undefined)throw new Error('claim review omitted passed');out.push(verdict('claim_review',decision.passed,null,decision.evidence,settings.reviewProvider,settings.reviewTemplate+settings.reviewModel));}
    else throw new Error(`unsupported job kind ${job.kind}`);
    return {verdicts:out};
  } finally {git(mirror,'worktree','remove','--force',nodeDir);if(job.parent_commit)git(mirror,'worktree','remove','--force',parentDir);}
}

export async function runRunner(url:string,token:string,settings:Settings,model:ModelCall=callModel,once=false):Promise<void> {
  const remote:Remote={url,auth:`Bearer ${token}`};const who=await request(remote,'GET','/whoami',Whoami);if(who.actor.kind!=='runner')throw new Error('runner token required');
  const root=mkdtempSync(join(tmpdir(),'fervo-runner-'));const mirror=join(root,'repo.git');
  git(root,'clone','--mirror','--quiet','-c',`http.${who.git_url}.extraHeader=Authorization: Bearer ${token}`,who.git_url,mirror);
  try {do {const job=await request(remote,'POST','/jobs/lease',LeaseJob.nullable(),{key:randomUUID(),body:{wait:once?0:30}});if(!job){if(once)return;continue;}let heartbeatError:unknown;const heartbeat=setInterval(()=>{void request(remote,'POST',`/jobs/${job.id}/heartbeat`,Job,{key:randomUUID(),body:{}}).catch(error=>{heartbeatError=error;});},30_000);let result:typeof JobResult._output;try{result=await executeJob(job,mirror,settings,model);}catch(error){result={verdicts:[],error:error instanceof Error?error.message:String(error)};}finally{clearInterval(heartbeat);}if(heartbeatError)throw heartbeatError;await request(remote,'POST',`/jobs/${job.id}/result`,Job,{key:randomUUID(),body:result});}while(!once);}finally{rmSync(root,{recursive:true,force:true});}
}

export function readSettings(paths:{judgeTemplate:string;reviewTemplate:string;anthropicModel:string;openaiModel:string;reviewProvider:string;reviewModel:string}):Settings{return {...paths,judgeTemplate:readFileSync(paths.judgeTemplate,'utf8'),reviewTemplate:readFileSync(paths.reviewTemplate,'utf8')};}
