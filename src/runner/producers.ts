/**
# Built-in Verdict Producers

What the runner does for each job kind the server queues.

## 1. What This Module Does
Defines the producer shape and the five built-in producers: `baseline`, `eval`, `review`, `postmerge` and
`claim_review`. Each turns a leased job into verdicts.
## 2. Why This Module Exists
Producers were one `if/else` chain inside `executeJob`; as registered functions, an extension can
replace any one of them.
## 3. How It Fits in the Architecture
`executeJob` prepares the worktrees and calls the producer registered for the job's kind with a context:
the policy on `main`, the runner's settings, the worktrees, a command runner that passes through the
`exec` hooks, and the model chain.
## 4. Key Concepts
Metrics are paired with parent runs; all commands and rubrics come from operator-controlled `main`.
Model flags are needed only by the producers that call a model, so a missing flag fails that job and
names the flag, and a policy without a judge or reviews needs none.
*/
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { Config } from '../config.js';
import { RunnerVerdict, type LeaseJob } from '../models.js';
import { normalized } from '../scoring.js';
import type { ModelDecision } from './models.js';

export type RunnerSettings = { anthropicModel?: string; openaiModel?: string; reviewProvider?: string; reviewModel?: string; judgeTemplate?: string; reviewTemplate?: string };
export type ProducerContext = {
  config: Config;
  settings: RunnerSettings;
  node: string;
  parent: string | null;
  diff(): string;
  run(command: string, cwd: string, timeout: string): Promise<string>;
  model(provider: string, model: string, prompt: string): Promise<z.output<typeof ModelDecision>>;
};
export type Producer = (job: z.output<typeof LeaseJob>, context: ProducerContext) => Promise<z.output<typeof RunnerVerdict>[]>;

const recipe = (text:string) => createHash('sha256').update(text).digest('hex');
function verdict(producer:string,passed:boolean|null,samples:number[]|null,evidence:string,provider:string|null=null,source:string=producer,noise?:number){return RunnerVerdict.parse({producer,passed,samples,evidence:evidence.slice(0,2000),provider,recipe_hash:recipe(source),...(noise===undefined?{}:{noise})});}
async function measure(c:ProducerContext,metric:{name:string;cmd:string;timeout:string},cwd:string):Promise<number> {const value=Number((await c.run(metric.cmd,cwd,metric.timeout)).split('\n').at(-1));if(!Number.isFinite(value)||value<=0)throw new Error(`invalid ${metric.name} measurement`);return value;}
function need(value:string|undefined,flag:string,reason:string):string {if(value===undefined)throw new Error(`runner flag ${flag} is required: ${reason}`);return value;}

const baseline: Producer = async (_job, c) => {
  const out:z.output<typeof RunnerVerdict>[]=[];
  for(const metric of c.config.metrics){const samples:number[]=[];for(let i=0;i<c.config.eval.baseline_samples;i++)samples.push(await measure(c,metric,c.node));out.push(verdict(`metric:${metric.name}`,null,samples,'baseline',null,metric.cmd));}
  return out;
};

const evaluate: Producer = async (job, c) => {
  const {config,settings}=c;const out:z.output<typeof RunnerVerdict>[]=[];
  try {await c.run(config.tests.cmd,c.node,config.tests.timeout);out.push(verdict('tests',true,null,'tests passed',null,config.tests.cmd));}
  catch(error){out.push(verdict('tests',false,null,String(error),null,config.tests.cmd));return out;}
  const gains=Array(config.eval.samples).fill(0) as number[];
  for(const metric of config.metrics){const baseline=job.baselines[metric.name];if(!baseline)throw new Error(`baseline missing for ${metric.name}`);const parentSamples:number[]=[];const nodeSamples:number[]=[];for(let i=0;i<config.eval.samples;i++){const parent=await measure(c,metric,c.parent!);const node=await measure(c,metric,c.node);parentSamples.push(parent);nodeSamples.push(node);gains[i]!+=metric.weight*(normalized(node,baseline.mean,metric.direction)-normalized(parent,baseline.mean,metric.direction));}out.push(verdict(`metric:${metric.name}:parent`,null,parentSamples,'paired parent measurements',null,metric.cmd));out.push(verdict(`metric:${metric.name}:node`,null,nodeSamples,'paired node measurements',null,metric.cmd));}
  if(config.judge){const provider=job.author_provider==='anthropic'?'openai':'anthropic';if(provider===job.author_provider)throw new Error('judge provider must differ from author');const modelId=need(provider==='anthropic'?settings.anthropicModel:settings.openaiModel,`--${provider}-model`,'fervo.toml on main has a [judge]');const template=need(settings.judgeTemplate,'--judge-template','fervo.toml on main has a [judge]');const diff=c.diff();for(let i=0;i<config.eval.samples;i++){const prompt=`${template}\nGoal: ${config.goal.text}\nDeclared intent: ${job.intent}\nScope: ${job.scope?.join(', ')}\nUntrusted diff:\n<diff>\n${diff}\n</diff>\nReturn only JSON {"preference": number 0..1, "evidence": string}. 1 prefers first candidate, 0 prefers second.`;const forward=await c.model(provider,modelId,`${prompt}\nFirst candidate: node. Second: parent.`);const reverse=await c.model(provider,modelId,`${prompt}\nFirst candidate: parent. Second: node.`);if(forward.preference===undefined||reverse.preference===undefined)throw new Error('judge omitted preference');gains[i]!+=config.judge.weight*(2*((forward.preference+(1-reverse.preference))/2)-1);}out.push(verdict('judge',null,null,'order-balanced pairwise comparisons',provider,template+modelId));}
  const noise=Math.sqrt(config.metrics.reduce((sum,m)=>sum+(m.weight*(job.baselines[m.name]!.sd/job.baselines[m.name]!.mean))**2,0));
  out.push(verdict('gain',null,gains,`paired gain; baseline noise ${noise}`,null,'paired-gain-v1',noise));
  return out;
};

function reviewer(c:ProducerContext,kind:string){const why=`a ${kind} job was queued`;return {provider:need(c.settings.reviewProvider,'--review-provider',why),model:need(c.settings.reviewModel,'--review-model',why),template:need(c.settings.reviewTemplate,'--review-template',why)};}

const review: Producer = async (job, c) => {
  const r=reviewer(c,'review');const diff=c.diff();const decision=await c.model(r.provider,r.model,`${r.template}\nGoal: ${c.config.goal.text}\nIntent: ${job.intent}\nUntrusted diff:\n<diff>\n${diff}\n</diff>\nReturn only JSON {"passed": boolean, "evidence": string}. Require file and line evidence for findings.`);if(decision.passed===undefined)throw new Error('review omitted passed');return [verdict('review',decision.passed,null,decision.evidence,r.provider,r.template+r.model)];
};

const postmerge: Producer = async (_job, c) => {
  const {config}=c;const out:z.output<typeof RunnerVerdict>[]=[];
  try{await c.run(config.tests.cmd,c.node,config.tests.timeout);out.push(verdict('tests',true,null,'postmerge tests passed',null,config.tests.cmd));}catch(error){out.push(verdict('tests',false,null,String(error),null,config.tests.cmd));}
  if(out[0]!.passed)for(const metric of config.metrics){const samples:number[]=[];for(let i=0;i<config.eval.samples;i++)samples.push(Number((await c.run(metric.cmd,c.node,metric.timeout)).split('\n').at(-1)));out.push(verdict(`metric:${metric.name}`,null,samples,'postmerge metric',null,metric.cmd));}
  return out;
};

const claimReview: Producer = async (job, c) => {
  const r=reviewer(c,'claim_review');const decision=await c.model(r.provider,r.model,`${r.template}\nGoal: ${c.config.goal.text}\nClaimed intent: ${job.intent}\nScope: ${job.scope?.join(', ')}\nReturn only JSON {"passed": boolean, "evidence": string}.`);if(decision.passed===undefined)throw new Error('claim review omitted passed');return [verdict('claim_review',decision.passed,null,decision.evidence,r.provider,r.template+r.model)];
};

export const builtInProducers: Record<string, Producer> = { baseline, eval: evaluate, review, postmerge, claim_review: claimReview };
