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
## 5. Identities
A clone made with an agent token belongs to that agent. A clone made with a human token holds an
enroller token instead, plus a Claude Code SessionStart hook (`fervo enroll`) that gives every session
its own actor and puts that actor's token in the session's shell as `FERVO_TOKEN`. The human token is
never written anywhere: human-only commands read it from `FERVO_TOKEN` or prompt for it on the
terminal. `fervo delegate` starts Claude Code with a grant, so that one session enrolls as a human.
## 6. Working Trees
`claim --checkout` gives every lease its own Git worktree at `<clone>/.fervo/worktrees/<lease>`,
created at the claim's `parent_commit`. Several agents can then share one clone: none of them moves
another's HEAD or index. The clone's own working tree is never switched. `.fervo/` is excluded from Git.
A claim replayed with the same key returns the same lease; when that lease's worktree already exists, the
command reuses it and reports it again. When only the lease branch exists (a first run interrupted after
`git worktree add` created the branch), the worktree is added on that branch instead of recreating it.
*/
import { Command, Option } from 'commander';
import { dirname, resolve } from 'node:path';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { git } from '../git.js';
import { cloneRemote, emit, loadRemote, request } from '../remote.js';
import { Actor, ActorCreated, ActorIn, EnrollerIn, EnrollIn, Grant, Claim, ClaimIn, ClaimOut, Context, Job, NodeStatus, ReasonIn, ReviewIn, Status, SubmitIn, SubmitOut, Verdict, Whoami } from '../models.js';
import { mainConfig } from '../config.js';
import { openDb } from '../store/db.js';
import { createFervoServer } from '../server/http.js';
import { installHook, checkPush } from '../server/git.js';
import { runRunner, readSettings } from '../runner/run.js';

const cli = new Command().name('fervo').description('JSON repo management for agent contributors');
const cwd = () => process.cwd();
const collect = (value: string, previous: string[]) => [...previous, value];
const newKey = (prefix: string) => `${prefix}-${randomBytes(8).toString('hex')}`;

function promptToken(): string {
  const read = spawnSync('/bin/sh', ['-c', 'printf "Fervo human token: " >/dev/tty && stty -echo </dev/tty && IFS= read -r t </dev/tty; s=$?; stty echo </dev/tty; printf "\\n" >/dev/tty; [ $s -eq 0 ] && printf %s "$t"'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  if (read.status !== 0 || !read.stdout) throw new Error('human token required: run this in a terminal, or set FERVO_TOKEN for this one command');
  return read.stdout;
}
const humanRemote = (dir: string) => process.env.FERVO_TOKEN ? loadRemote(dir) : { url: cloneRemote(dir).url, auth: `Bearer ${promptToken()}` };

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

cli.command('clone').description('Clone a Fervo repo: for an agent token, as that agent; for a human token, with session enrollment for Claude Code')
  .argument('<url>').argument('<directory>')
  .addOption(new Option('--token <token>', 'actor token; prompted on the terminal when absent').env('FERVO_TOKEN'))
  .option('--provider <provider>', 'provider of the sessions enrolled from a human clone', 'anthropic')
  .option('--harness <harness>', 'harness of the sessions enrolled from a human clone', 'claude-code')
  .action(async (url: string, directory: string, options: { token?: string; provider: string; harness: string }) => {
    const remote = { url: url.replace(/\/$/, ''), auth: `Bearer ${options.token ?? promptToken()}` };
    const who = await request(remote, 'GET', '/whoami', Whoami);
    if (who.actor.kind !== 'agent' && who.actor.kind !== 'human') throw new Error(`actor kind ${who.actor.kind} cannot clone`);
    const stored = who.actor.kind === 'agent' ? { actor: who.actor, auth: remote.auth } : await request(remote, 'POST', '/enrollers', ActorCreated, { key: newKey('enroller'), body: EnrollerIn.parse({ provider: options.provider, harness: options.harness }) }).then(out => ({ actor: out.actor, auth: `Bearer ${out.token}` }));
    git(cwd(), 'clone', '--quiet', '-c', `http.${who.git_url}.extraHeader=Authorization: ${stored.auth}`, '-c', `fervo.url=${remote.url}`, who.git_url, directory);
    appendFileSync(resolve(directory, '.git', 'info', 'exclude'), '.fervo/\n');
    if (who.actor.kind === 'human') {
      mkdirSync(resolve(directory, '.claude'), { recursive: true });
      const hook = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `"${process.execPath}" "${resolve(process.argv[1]!)}" enroll` }] }] } };
      writeFileSync(resolve(directory, '.claude', 'settings.local.json'), `${JSON.stringify(hook, null, 2)}\n`, { flag: 'wx' });
      appendFileSync(resolve(directory, '.git', 'info', 'exclude'), '.claude/settings.local.json\n');
    }
    emit({ path: resolve(directory), actor: stored.actor });
  });

cli.command('enroll').description('Claude Code SessionStart hook: give this session its own actor and token')
  .action(async () => {
    let input = ''; for await (const chunk of process.stdin) input += chunk.toString();
    const hook = z.object({ session_id: z.string(), cwd: z.string(), model: z.string().optional() }).parse(JSON.parse(input));
    const clone = cloneRemote(hook.cwd);
    if (process.env.FERVO_TOKEN) {
      const inherited = await request({ url: clone.url, auth: `Bearer ${process.env.FERVO_TOKEN}` }, 'GET', '/whoami', Whoami);
      if (inherited.actor.session === null) {
        appendFileSync(process.env.CLAUDE_ENV_FILE!, 'unset FERVO_TOKEN\n');
        process.stderr.write(`FERVO_TOKEN of ${inherited.actor.id} is in the environment Claude Code inherited, where the agent can read it: unset it and restart\n`);
        process.exitCode = 2;
        return;
      }
    }
    const out = await request(clone, 'POST', '/enroll', ActorCreated, { key: newKey('enroll'), body: EnrollIn.parse({ session: hook.session_id, model: hook.model ?? null, ...(process.env.FERVO_GRANT ? { grant: process.env.FERVO_GRANT } : {}) }) });
    appendFileSync(process.env.CLAUDE_ENV_FILE!, `export FERVO_TOKEN=${out.token}\nunset FERVO_GRANT\n`);
    const skill = readFileSync(new URL('../../../skill/SKILL.md', import.meta.url), 'utf8');
    emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `This session is the Fervo actor ${out.actor.id} (kind ${out.actor.kind}). FERVO_TOKEN in your shell is its token; run every fervo command with it and never look for another.\n\n${skill}` } });
  });

cli.command('delegate').description('Start Claude Code in this clone with human powers for that session')
  .argument('[args...]', 'arguments passed to claude; put them after --').allowUnknownOption()
  .action(async (args: string[]) => {
    const grant = await request(humanRemote(cwd()), 'POST', '/grants', Grant, { key: newKey('grant') });
    const { FERVO_TOKEN: _, ...env } = process.env;
    const child = spawnSync('claude', args, { stdio: 'inherit', env: { ...env, FERVO_GRANT: grant.grant! } });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
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
      if (!existsSync(worktree)) {
        if (git(cwd(), 'branch', '--list', out.branch)) git(cwd(), 'worktree', 'add', '--quiet', worktree, out.branch);
        else git(cwd(), 'worktree', 'add', '--quiet', '-b', out.branch, worktree, out.parent_commit);
      }
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
    const remote = loadRemote(cwd());
    const who = await request(remote, 'GET', '/whoami', Whoami);
    const gitUrl = git(cwd(), 'remote', 'get-url', 'origin');
    git(cwd(), '-c', `http.${gitUrl}.extraHeader=`, '-c', `http.${gitUrl}.extraHeader=Authorization: ${remote.auth}`, 'push', '--quiet', 'origin', `HEAD:refs/heads/${who.branch_prefix}/${options.lease}`);
    emit(await request(remote, 'POST', '/submit', SubmitOut, { key: options.key, body: SubmitIn.parse({ lease: options.lease, commit }) }));
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
      emit(await request(action === 'abandon' ? loadRemote(cwd()) : humanRemote(cwd()), 'POST', `/nodes/${encodeURIComponent(node)}/${action}`, NodeStatus, { key: options.key, body: ReasonIn.parse({ reason: options.reason }) }));
    });
}

cli.command('retry').description('Requeue the failed evaluation or review of a node')
  .argument('<node>').requiredOption('--key <key>')
  .action(async (node:string,options:{key:string})=>emit(await request(loadRemote(cwd()),'POST',`/nodes/${encodeURIComponent(node)}/retry`,NodeStatus,{key:options.key})));

cli.command('review').description('Human verdict on a node')
  .argument('<node>').option('--pass').option('--fail').requiredOption('--evidence <text>').requiredOption('--key <key>')
  .action(async (node: string, options: { pass?: boolean; fail?: boolean; evidence: string; key: string }) => {
    if (Boolean(options.pass) === Boolean(options.fail)) throw new Error('choose exactly one of --pass or --fail');
    emit(await request(humanRemote(cwd()), 'POST', `/nodes/${encodeURIComponent(node)}/verdicts`, Verdict, { key: options.key, body: ReviewIn.parse({ passed: Boolean(options.pass), evidence: options.evidence }) }));
  });

const actor = cli.command('actor').description('Manage actors');
actor.command('add').argument('<id>').requiredOption('--kind <kind>').requiredOption('--key <key>')
  .option('--provider <provider>').option('--model <model>').option('--harness <harness>')
  .action(async (id: string, options: { kind: string; key: string; provider?: string; model?: string; harness?: string }) => {
    const body = ActorIn.parse({ id, kind: options.kind, provider: options.provider ?? null, model: options.model ?? null, harness: options.harness ?? null });
    emit(await request(humanRemote(cwd()), 'POST', '/actors', ActorCreated, { key: options.key, body }));
  });
actor.command('list').action(async () => emit(await request(humanRemote(cwd()), 'GET', '/actors', z.array(Actor))));
actor.command('disable').argument('<id>').requiredOption('--key <key>')
  .action(async (id: string, options: { key: string }) => emit(await request(humanRemote(cwd()), 'POST', `/actors/${encodeURIComponent(id)}/disable`, Actor, { key: options.key })));

cli.command('baseline').description('Re-measure main for a new scoring epoch').requiredOption('--key <key>')
  .action(async (options: { key: string }) => emit(await request(humanRemote(cwd()), 'POST', '/baseline', Job, { key: options.key })));

cli.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
