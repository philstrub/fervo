#!/usr/bin/env node
/**
# Fervo Commands

The JSON command surface for agents and operators.

## 1. What This Module Does
Exposes clone, context, claim, submit, status, and the current human controls.
## 2. Why This Module Exists
Agents need small literal commands with stable objects and predictable retries.
## 3. How It Fits in the Architecture
Commands validate API data and leave state decisions to the server.
## 4. Key Concepts
Claims precede work; a moved target requires a new claim with supersedes; writes use idempotency keys.
## 5. Working Trees
`claim --checkout` gives every lease its own Git worktree at `<clone>/.fervo/worktrees/<lease>`,
created at the claim's `parent_commit`. Several agents can then share one clone: none of them moves
another's HEAD or index. The clone's own working tree is never switched. `.fervo/` is excluded from Git.
*/
import { Command, Option } from 'commander';
import { dirname, resolve } from 'node:path';
import { appendFileSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { git } from '../git.js';
import { emit, loadRemote, request } from '../remote.js';
import { Actor, ActorCreated, ActorIn, Claim, ClaimIn, ClaimOut, Context, Job, NodeStatus, ReasonIn, ReviewIn, Status, SubmitIn, SubmitOut, Verdict, Whoami } from '../models.js';
import { mainConfig } from '../config.js';
import { openDb } from '../store/db.js';
import { createFervoServer } from '../server/http.js';
import { installHook, checkPush } from '../server/git.js';
import { runRunner, readSettings } from '../runner/run.js';

const cli = new Command().name('fervo').description('JSON repo management for agent contributors');
const cwd = () => process.cwd();
const collect = (value: string, previous: string[]) => [...previous, value];

cli.command('init').description('Initialize a managed bare repository and first human actor')
  .requiredOption('--source <repo>').requiredOption('--root <directory>').requiredOption('--actor <id>')
  .action((options: { source: string; root: string; actor: string }) => {
    const root=resolve(options.root);
    mkdirSync(root);
    git(cwd(),'clone','--bare','--quiet',resolve(options.source),resolve(root,'repo.git'));
    mainConfig(resolve(root,'repo.git'));
    mkdirSync(resolve(root,'.fervo'));
    const db=openDb(root);
    const token=randomBytes(32).toString('hex');
    const at=new Date().toISOString();
    db.prepare('INSERT INTO actors(id,kind,provider,model,harness,token_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(options.actor,'human',null,null,null,createHash('sha256').update(token).digest('hex'),at);
    const commit=git(root,'--git-dir',resolve(root,'repo.git'),'rev-parse','refs/heads/main');
    db.prepare('INSERT INTO nodes(id,commit_sha,parent_node,claim,author,intent,scope,changed_paths,state,score_mean,score_lo,score_hi,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('n_0',commit,null,null,options.actor,'baseline','[]','[]','merged',1,1,1,commit,at);
    db.prepare('INSERT INTO events(at,actor,type,subject,data) VALUES(?,?,?,?,?)').run(at,options.actor,'initialized','n_0','{}');
    db.prepare('INSERT INTO jobs(id,kind,node,claim,payload,state,created_at) VALUES(?,?,?,?,?,?,?)').run(`j_${randomBytes(5).toString('hex')}`,'baseline',null,null,'{}','queued',at);
    db.close();
    installHook(root,resolve(process.argv[1]!));
    emit({root,actor:options.actor,token,main:{node:'n_0',commit}});
  });

cli.command('serve').description('Serve authenticated Git and JSON API')
  .requiredOption('--root <directory>').option('--host <host>','listen host','127.0.0.1').option('--port <port>','listen port','8765')
  .action(async (options: {root:string;host:string;port:string}) => {
    const server=createFervoServer(resolve(options.root));
    await new Promise<void>(resolve=>server.listen(Number(options.port),options.host,resolve));
    process.stderr.write(`[serve] listening on ${options.host}:${options.port}\n`);
  });

cli.command('hook').command('pre-receive').description('Validate pushed refs in a managed bare repository')
  .action(async()=>{
    let input='';for await(const chunk of process.stdin)input+=chunk.toString();
    checkPush(process.env.REMOTE_USER!,process.env.FERVO_ACTOR_KIND!,input);
  });

cli.command('runner').description('Lease and evaluate jobs on the operator machine')
  .requiredOption('--remote <url>').addOption(new Option('--token <token>').env('FERVO_TOKEN').makeOptionMandatory())
  .requiredOption('--judge-template <file>').requiredOption('--review-template <file>')
  .requiredOption('--anthropic-model <id>').requiredOption('--openai-model <id>')
  .requiredOption('--review-provider <provider>').requiredOption('--review-model <id>')
  .option('--concurrency <count>','parallel job workers','2')
  .option('--once','process one available job and exit')
  .action(async (options:{remote:string;token:string;judgeTemplate:string;reviewTemplate:string;anthropicModel:string;openaiModel:string;reviewProvider:string;reviewModel:string;concurrency:string;once?:boolean})=>{
    const count=Number(options.concurrency);
    if(!Number.isInteger(count)||count<1)throw new Error('--concurrency must be a positive integer');
    const settings=readSettings(options);
    await Promise.all(Array.from({length:count},()=>runRunner(options.remote,options.token,settings,undefined,Boolean(options.once))));
  });

cli.command('clone').description('Clone a Fervo repo and store this actor\'s token in Git config')
  .argument('<url>').argument('<directory>')
  .addOption(new Option('--token <token>', 'actor token').env('FERVO_TOKEN').makeOptionMandatory())
  .action(async (url: string, directory: string, options: { token: string }) => {
    const remote = { url: url.replace(/\/$/, ''), auth: `Bearer ${options.token}` };
    const who = await request(remote, 'GET', '/whoami', Whoami);
    if (who.actor.kind !== 'agent' && who.actor.kind !== 'human') throw new Error(`actor kind ${who.actor.kind} cannot clone`);
    const prefix = `${who.actor.kind === 'agent' ? 'agents' : 'humans'}/${who.actor.id}`;
    git(cwd(), 'clone', '--quiet', '-c', `http.${who.git_url}.extraHeader=Authorization: ${remote.auth}`, '-c', `fervo.url=${remote.url}`, '-c', `fervo.prefix=${prefix}`, who.git_url, directory);
    appendFileSync(resolve(directory, '.git', 'info', 'exclude'), '.fervo/\n');
    emit({ path: resolve(directory), actor: who.actor, branch_prefix: prefix });
  });

cli.command('context').description('Read the goal, frontier, claims, tried directions, and rules')
  .option('--scope <path>', 'filter overlapping claims and tried directions', collect, [])
  .action(async (options: { scope: string[] }) => {
    const params = new URLSearchParams();
    for (const scope of options.scope) params.append('scope', scope);
    emit(await request(loadRemote(cwd()), 'GET', '/context', Context, { params }));
  });

cli.command('claim').description('Declare intent and scope before editing')
  .requiredOption('--parent <node>').requiredOption('--scope <path>', 'repeat for each path', collect, [])
  .requiredOption('--intent <text>').requiredOption('--key <key>')
  .option('--supersedes <node>', 'prior node being rebased onto a moved target')
  .option('--checkout', 'fetch the parent and create the lease branch in its own worktree')
  .action(async (options: { parent: string; scope: string[]; intent: string; key: string; supersedes?: string; checkout?: boolean }) => {
    const body = ClaimIn.parse({ parent: options.parent, scope: options.scope, intent: options.intent, ...(options.supersedes ? { supersedes: options.supersedes } : {}) });
    const out = await request(loadRemote(cwd()), 'POST', '/claims', ClaimOut, { key: options.key, body });
    if (options.checkout) {
      git(cwd(), 'fetch', '--quiet', 'origin', out.parent_ref);
      const worktree = resolve(dirname(git(cwd(), 'rev-parse', '--path-format=absolute', '--git-common-dir')), '.fervo', 'worktrees', out.lease);
      git(cwd(), 'worktree', 'add', '--quiet', '-b', `${git(cwd(), 'config', '--get', 'fervo.prefix')}/${out.lease}`, worktree, out.parent_commit);
      emit({ ...out, worktree });
      return;
    }
    emit(out);
  });

cli.command('release').description('Release an unsubmitted claim')
  .argument('<lease>').requiredOption('--key <key>')
  .action(async (lease: string, options: { key: string }) => emit(await request(loadRemote(cwd()), 'POST', `/claims/${encodeURIComponent(lease)}/release`, Claim, { key: options.key })));

cli.command('renew').description('Extend an active claim lease')
  .argument('<lease>').requiredOption('--key <key>')
  .action(async (lease: string, options: { key: string }) => emit(await request(loadRemote(cwd()), 'POST', `/claims/${encodeURIComponent(lease)}/renew`, Claim, { key: options.key })));

cli.command('submit').description('Push HEAD under the lease and submit it for evaluation')
  .requiredOption('--lease <lease>').requiredOption('--key <key>')
  .action(async (options: { lease: string; key: string }) => {
    if (git(cwd(), 'status', '--porcelain', '--untracked-files=no')) throw new Error('uncommitted tracked changes: commit or stash before submit');
    const commit = git(cwd(), 'rev-parse', 'HEAD');
    const prefix = git(cwd(), 'config', '--get', 'fervo.prefix');
    git(cwd(), 'push', '--quiet', 'origin', `HEAD:refs/heads/${prefix}/${options.lease}`);
    emit(await request(loadRemote(cwd()), 'POST', '/submit', SubmitOut, { key: options.key, body: SubmitIn.parse({ lease: options.lease, commit }) }));
  });

cli.command('status').description('Read a lease, node, or job; wait for a bounded change event')
  .argument('<id>').option('--wait', 'wait server-side for a state change')
  .option('--timeout <seconds>', 'maximum server wait, up to 30 seconds', '30')
  .action(async (id: string, options: { wait?: boolean; timeout: string }) => {
    const params = new URLSearchParams();
    if (options.wait) {
      const seconds = Number(options.timeout);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) throw new Error('--timeout must be an integer from 1 to 30');
      params.set('wait', String(seconds));
    }
    emit(await request(loadRemote(cwd()), 'GET', `/status/${encodeURIComponent(id)}`, Status, { params }));
  });

for (const action of ['abandon', 'merge', 'veto', 'revert'] as const) {
  cli.command(action).description(`${action} a node with a recorded reason`)
    .argument('<node>').requiredOption('--reason <reason>').requiredOption('--key <key>')
    .action(async (node: string, options: { reason: string; key: string }) => {
      emit(await request(loadRemote(cwd()), 'POST', `/nodes/${encodeURIComponent(node)}/${action}`, NodeStatus, { key: options.key, body: ReasonIn.parse({ reason: options.reason }) }));
    });
}

cli.command('retry').description('Requeue evaluation of a failed node')
  .argument('<node>').requiredOption('--key <key>')
  .action(async (node:string,options:{key:string})=>emit(await request(loadRemote(cwd()),'POST',`/nodes/${encodeURIComponent(node)}/retry`,NodeStatus,{key:options.key})));

cli.command('review').description('Human verdict on a node')
  .argument('<node>').option('--pass').option('--fail').requiredOption('--evidence <text>').requiredOption('--key <key>')
  .action(async (node: string, options: { pass?: boolean; fail?: boolean; evidence: string; key: string }) => {
    if (Boolean(options.pass) === Boolean(options.fail)) throw new Error('choose exactly one of --pass or --fail');
    emit(await request(loadRemote(cwd()), 'POST', `/nodes/${encodeURIComponent(node)}/verdicts`, Verdict, { key: options.key, body: ReviewIn.parse({ passed: Boolean(options.pass), evidence: options.evidence }) }));
  });

const actor = cli.command('actor').description('Manage actors');
actor.command('add').argument('<id>').requiredOption('--kind <kind>').requiredOption('--key <key>')
  .option('--provider <provider>').option('--model <model>').option('--harness <harness>')
  .action(async (id: string, options: { kind: string; key: string; provider?: string; model?: string; harness?: string }) => {
    const body = ActorIn.parse({ id, kind: options.kind, provider: options.provider ?? null, model: options.model ?? null, harness: options.harness ?? null });
    emit(await request(loadRemote(cwd()), 'POST', '/actors', ActorCreated, { key: options.key, body }));
  });
actor.command('list').action(async () => emit(await request(loadRemote(cwd()), 'GET', '/actors', z.array(Actor))));
actor.command('disable').argument('<id>').requiredOption('--key <key>')
  .action(async (id: string, options: { key: string }) => emit(await request(loadRemote(cwd()), 'POST', `/actors/${encodeURIComponent(id)}/disable`, Actor, { key: options.key })));

cli.command('baseline').description('Re-measure main for a new scoring epoch').requiredOption('--key <key>')
  .action(async (options: { key: string }) => emit(await request(loadRemote(cwd()), 'POST', '/baseline', Job, { key: options.key })));

cli.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
