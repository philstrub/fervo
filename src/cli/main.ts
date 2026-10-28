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
*/
import { Command, Option } from 'commander';
import { resolve } from 'node:path';
import { z } from 'zod';
import { git } from '../git.js';
import { emit, loadRemote, request } from '../remote.js';
import { Actor, ActorCreated, ActorIn, Claim, ClaimIn, ClaimOut, Context, Job, NodeStatus, ReasonIn, ReviewIn, Status, SubmitIn, SubmitOut, Verdict, Whoami } from '../models.js';

const cli = new Command().name('fervo').description('JSON repo management for agent contributors');
const cwd = () => process.cwd();
const collect = (value: string, previous: string[]) => [...previous, value];

cli.command('clone').description('Clone a Fervo repo and store this actor\'s token in Git config')
  .argument('<url>').argument('<directory>')
  .addOption(new Option('--token <token>', 'actor token').env('FERVO_TOKEN').makeOptionMandatory())
  .action(async (url: string, directory: string, options: { token: string }) => {
    const remote = { url: url.replace(/\/$/, ''), auth: `Bearer ${options.token}` };
    const who = await request(remote, 'GET', '/whoami', Whoami);
    if (who.actor.kind !== 'agent' && who.actor.kind !== 'human') throw new Error(`actor kind ${who.actor.kind} cannot clone`);
    const prefix = `${who.actor.kind === 'agent' ? 'agents' : 'humans'}/${who.actor.id}`;
    git(cwd(), 'clone', '--quiet', '-c', `http.${who.git_url}.extraHeader=Authorization: ${remote.auth}`, '-c', `fervo.url=${remote.url}`, '-c', `fervo.prefix=${prefix}`, who.git_url, directory);
    emit({ path: resolve(directory), actor: who.actor, branch_prefix: prefix });
  });

cli.command('context').description('Read the goal, frontier, claims, tried directions, and rules')
  .option('--scope <path>', 'filter overlapping claims and tried directions', collect, [])
  .option('--summary', 'include a runner-authored briefing')
  .action(async (options: { scope: string[]; summary?: boolean }) => {
    const params = new URLSearchParams();
    for (const scope of options.scope) params.append('scope', scope);
    if (options.summary) params.set('summary', 'true');
    emit(await request(loadRemote(cwd()), 'GET', '/context', Context, { params }));
  });

cli.command('claim').description('Declare intent and scope before editing')
  .requiredOption('--parent <node>').requiredOption('--scope <path>', 'repeat for each path', collect, [])
  .requiredOption('--intent <text>').requiredOption('--key <key>')
  .option('--supersedes <node>', 'prior node being rebased onto a moved target')
  .option('--checkout', 'fetch parent and create the lease branch')
  .action(async (options: { parent: string; scope: string[]; intent: string; key: string; supersedes?: string; checkout?: boolean }) => {
    const body = ClaimIn.parse({ parent: options.parent, scope: options.scope, intent: options.intent, ...(options.supersedes ? { supersedes: options.supersedes } : {}) });
    const out = await request(loadRemote(cwd()), 'POST', '/claims', ClaimOut, { key: options.key, body });
    if (options.checkout) {
      git(cwd(), 'fetch', '--quiet', 'origin', out.parent_ref);
      git(cwd(), 'checkout', '--quiet', '-b', `${git(cwd(), 'config', '--get', 'fervo.prefix')}/${out.lease}`, 'FETCH_HEAD');
    }
    emit(out);
  });

cli.command('release').description('Release an unsubmitted claim')
  .argument('<lease>').requiredOption('--key <key>')
  .action(async (lease: string, options: { key: string }) => emit(await request(loadRemote(cwd()), 'POST', `/claims/${encodeURIComponent(lease)}/release`, Claim, { key: options.key })));

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
