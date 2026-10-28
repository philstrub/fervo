/**
# CLI Contract Tests

Executable checks for the agent-facing JSON and Git workflow.

## 1. What This Module Does
Runs the built CLI against a local HTTP server and a real temporary Git repo.
## 2. Why This Module Exists
Command flags, response validation, headers, and push behavior can drift independently.
## 3. How It Fits in the Architecture
These tests cover the CLI boundary while the state-writing server is developed separately.
## 4. Key Concepts
A write is retryable by key; a rejected policy result is ordinary JSON; submit pushes before posting its commit.
*/
import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const binary = resolve('dist/src/cli/main.js');
const actor = { id: 'codex-1', kind: 'agent', provider: 'openai', model: 'codex', harness: 'codex', owner: null, session: null, disabled: false };
const context = { goal: 'Improve parser', metrics: [], main: { commit: 'abc', node: 'n_0' }, frontier: [], claims: [], tried: [], rules: { pinned: ['bench/**'], requirements_by_path: { '*': ['tests'] } }, mine: { leases: [], updates: [] }, frontier_version: 1 };
const node = { node: 'n_1', state: 'rejected', outcome: null, delta: null, interval: null, rank: null, reason: 'pinned path', job: null, next_action: 'stop' };

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function cli(cwd: string, ...args: string[]) {
  return exec(process.execPath, [binary, ...args], { cwd, encoding: 'utf8' });
}

async function cliAs(token: string, cwd: string, ...args: string[]) {
  return exec(process.execPath, [binary, ...args], { cwd, encoding: 'utf8', env: { ...process.env, FERVO_TOKEN: token } });
}

test('context, claim, status wait and submit use compact JSON and the required key', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fervo-cli-'));
  const calls: { method: string; path: string; key: string | null; auth: string | undefined; body: unknown }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const path = new URL(request.url!, 'http://localhost');
    calls.push({ method: request.method!, path: path.pathname + path.search, key: request.headers['idempotency-key']?.toString() ?? null, auth: request.headers.authorization, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null });
    const result = path.pathname === '/whoami' ? { actor, git_url: bare, branch_prefix: 'agents/codex-1' } : path.pathname === '/context' ? context : path.pathname === '/claims' ? { lease: 'l_1', branch: 'agents/codex-1/l_1', parent: 'n_0', parent_commit: 'abc', parent_ref: 'refs/fervo/nodes/n_0', expires_at: 'tomorrow', blocked: [], overlaps: [] } : path.pathname === '/submit' ? { node: 'n_1', job: 'j_1' } : node;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(result));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  const bare = join(root, 'repo.git');
  const work = join(root, 'work');
  try {
    git(root, 'init', '--bare', bare);
    git(root, 'init', work);
    git(work, 'config', 'user.email', 'test@example.com');
    git(work, 'config', 'user.name', 'Tester');
    git(work, 'commit', '--allow-empty', '-m', 'initial');
    git(work, 'remote', 'add', 'origin', bare);
    git(work, 'config', 'fervo.url', url);
    git(work, 'config', `http.${bare}.extraHeader`, 'Authorization: Bearer secret');
    const contextResult = await cli(work, 'context', '--scope', 'src/');
    assert.deepEqual(JSON.parse(contextResult.stdout), context);
    assert.equal(contextResult.stdout.split('\n').length, 2);
    const claimResult = await cli(work, 'claim', '--parent', 'n_0', '--scope', 'src/', '--intent', 'speed up parsing', '--key', 'claim-1');
    assert.equal(JSON.parse(claimResult.stdout).lease, 'l_1');
    const statusResult = await cli(work, 'status', 'n_1', '--wait', '--timeout', '12');
    assert.deepEqual(JSON.parse(statusResult.stdout), node);
    const submitResult = await cli(work, 'submit', '--lease', 'l_1', '--key', 'submit-1');
    assert.deepEqual(JSON.parse(submitResult.stdout), { node: 'n_1', job: 'j_1' });
    assert.equal(git(bare, 'rev-parse', 'refs/heads/agents/codex-1/l_1'), git(work, 'rev-parse', 'HEAD'));
    assert.deepEqual(calls.map(call => [call.method, call.path, call.key]), [
      ['GET', '/context?scope=src%2F', null], ['POST', '/claims', 'claim-1'], ['GET', '/status/n_1?wait=12', null], ['GET', '/whoami', null], ['POST', '/submit', 'submit-1'],
    ]);
    assert.ok(calls.every(call => call.auth === 'Bearer secret'));
    await cliAs('session', work, 'context');
    assert.equal(calls.at(-1)?.auth, 'Bearer session');
    assert.deepEqual(calls[1]?.body, { parent: 'n_0', scope: ['src/'], intent: 'speed up parsing' });
    assert.deepEqual(calls[4]?.body, { lease: 'l_1', commit: git(work, 'rev-parse', 'HEAD') });
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('missing key and malformed API response exit with diagnostics on stderr', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fervo-cli-'));
  const server = createServer((_request, response) => response.end('{}'));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    git(root, 'init');
    git(root, 'remote', 'add', 'origin', 'file:///unused');
    git(root, 'config', 'fervo.url', url);
    git(root, 'config', 'http.file:///unused.extraHeader', 'Authorization: Bearer secret');
    await assert.rejects(cli(root, 'claim', '--parent', 'n_0', '--scope', 'src/', '--intent', 'work'), error => {
      const failed = error as { stdout: string; stderr: string };
      assert.equal(failed.stdout, '');
      assert.match(failed.stderr, /required option '--key <key>'/);
      return true;
    });
    await assert.rejects(cli(root, 'context'), error => {
      const failed = error as { stdout: string; stderr: string };
      assert.equal(failed.stdout, '');
      assert.match(failed.stderr, /goal/);
      return true;
    });
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('clone stores an agent token in Git config and a rebased claim links its old node', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fervo-clone-'));
  const bare = join(root, 'repo.git');
  const seed = join(root, 'seed');
  const clone = join(root, 'clone');
  const calls: unknown[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    if (request.url === '/whoami') response.end(JSON.stringify({ actor, git_url: bare, branch_prefix: 'agents/codex-1' }));
    else {
      calls.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.end(JSON.stringify({ lease: 'l_2', branch: 'agents/codex-1/l_2', parent: 'n_1', parent_commit: 'abc', parent_ref: 'refs/fervo/nodes/n_1', expires_at: 'tomorrow', blocked: [], overlaps: [] }));
    }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    git(root, 'init', '--bare', bare);
    git(root, 'init', seed);
    git(seed, 'config', 'user.email', 'test@example.com');
    git(seed, 'config', 'user.name', 'Tester');
    git(seed, 'commit', '--allow-empty', '-m', 'initial');
    git(seed, 'remote', 'add', 'origin', bare);
    git(seed, 'push', 'origin', 'HEAD:main');
    git(bare, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    const result = await cli(root, 'clone', url, clone, '--token', 'secret');
    assert.equal(JSON.parse(result.stdout).actor.id, 'codex-1');
    assert.equal(git(clone, 'config', '--get', 'fervo.url'), url);
    assert.equal(git(clone, 'config', '--get', `http.${bare}.extraHeader`), 'Authorization: Bearer secret');
    await cli(clone, 'claim', '--parent', 'n_1', '--supersedes', 'n_0', '--scope', 'src/', '--intent', 'rebase', '--key', 'new-lease');
    assert.deepEqual(calls, [{ parent: 'n_1', supersedes: 'n_0', scope: ['src/'], intent: 'rebase' }]);
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('operator writes preserve idempotency keys and return validated objects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fervo-operator-'));
  const calls: { path: string; key: string | undefined; body: unknown }[] = [];
  const human = { ...actor, id: 'filippo', kind: 'human' };
  const claim = { lease: 'l_1', holder: 'filippo', parent: 'n_0', intent: 'docs', scope: ['docs/'], state: 'released', expires_at: 'tomorrow' };
  const verdict = { id: 'v_1', node: 'n_1', reviewer: 'filippo', producer: 'human', provider: null, passed: false, evidence: 'tests failed' };
  const job = { id: 'j_2', kind: 'baseline', node: null, state: 'queued' };
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const path = request.url!;
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    calls.push({ path, key: request.headers['idempotency-key']?.toString(), body });
    const value = path === '/actors' ? { actor: human, token: 'shown-once' } : path.endsWith('/disable') ? human : path.endsWith('/release') ? claim : path.endsWith('/verdicts') ? verdict : path === '/baseline' ? job : node;
    response.end(JSON.stringify(value));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  try {
    git(root, 'init');
    git(root, 'remote', 'add', 'origin', 'file:///unused');
    git(root, 'config', 'fervo.url', `http://127.0.0.1:${(server.address() as { port: number }).port}`);
    git(root, 'config', 'http.file:///unused.extraHeader', 'Authorization: Bearer secret');
    await assert.rejects(cli(root, 'merge', 'n_1', '--reason', 'manual override', '--key', 'merge-0'), /human token required/);
    assert.equal(JSON.parse((await cliAs('human', root, 'actor', 'add', 'filippo', '--kind', 'human', '--key', 'actor-1')).stdout).token, 'shown-once');
    await cliAs('human', root, 'actor', 'disable', 'filippo', '--key', 'actor-2');
    await cli(root, 'release', 'l_1', '--key', 'release-1');
    await cliAs('human', root, 'review', 'n_1', '--fail', '--evidence', 'tests failed', '--key', 'review-1');
    await cliAs('human', root, 'merge', 'n_1', '--reason', 'manual override', '--key', 'merge-1');
    await cliAs('human', root, 'baseline', '--key', 'baseline-1');
    assert.deepEqual(calls.map(call => [call.path, call.key]), [
      ['/actors', 'actor-1'], ['/actors/filippo/disable', 'actor-2'], ['/claims/l_1/release', 'release-1'], ['/nodes/n_1/verdicts', 'review-1'], ['/nodes/n_1/merge', 'merge-1'], ['/baseline', 'baseline-1'],
    ]);
    assert.deepEqual(calls[0]?.body, { id: 'filippo', kind: 'human', provider: null, model: null, harness: null });
    assert.deepEqual(calls[3]?.body, { passed: false, evidence: 'tests failed' });
    assert.deepEqual(calls[4]?.body, { reason: 'manual override' });
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('concurrent claims in one clone get separate worktrees and leave the clone untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fervo-worktree-'));
  const bare = join(root, 'repo.git');
  const seed = join(root, 'seed');
  const clone = join(root, 'clone');
  let leases = 0;
  const server = createServer(async (request, response) => {
    for await (const _chunk of request);
    const base = git(bare, 'rev-parse', 'refs/heads/main');
    if (request.url === '/claims') leases++;
    response.end(JSON.stringify(request.url === '/whoami' ? { actor, git_url: bare, branch_prefix: 'agents/codex-1' } : request.url === '/claims' ? { lease: `l_${leases}`, branch: `agents/codex-1/l_${leases}`, parent: 'n_0', parent_commit: base, parent_ref: 'refs/heads/main', expires_at: 'tomorrow', blocked: [], overlaps: [] } : { node: `n_${leases}`, job: 'j_1' }));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  try {
    git(root, 'init', '--bare', '-b', 'main', bare);
    git(root, 'init', '-b', 'main', seed);
    git(seed, 'config', 'user.email', 'test@example.com');
    git(seed, 'config', 'user.name', 'Tester');
    await writeFile(join(seed, 'a.txt'), '1\n');
    git(seed, 'add', 'a.txt');
    git(seed, 'commit', '-m', 'initial');
    git(seed, 'push', bare, 'HEAD:main');
    git(root, 'clone', '--quiet', '-c', `fervo.url=http://127.0.0.1:${(server.address() as { port: number }).port}`, '-c', `http.${bare}.extraHeader=Authorization: Bearer secret`, bare, clone);
    await writeFile(join(clone, '.git', 'info', 'exclude'), '.fervo/\n');
    const claims = await Promise.all([1, 2].map(async n => JSON.parse((await cli(clone, 'claim', '--parent', 'n_0', '--scope', 'a.txt', '--intent', `set ${n}`, '--key', `claim-${n}`, '--checkout')).stdout)));
    assert.notEqual(claims[0].worktree, claims[1].worktree);
    for (const [index, claim] of claims.entries()) {
      assert.equal(git(claim.worktree, 'branch', '--show-current'), `agents/codex-1/${claim.lease}`);
      await writeFile(join(claim.worktree, 'a.txt'), `${index + 2}\n`);
      git(claim.worktree, '-c', 'user.name=Agent', '-c', 'user.email=agent@example.com', 'commit', '-qam', `set ${index + 2}`);
    }
    await Promise.all(claims.map(claim => cli(claim.worktree, 'submit', '--lease', claim.lease, '--key', `submit-${claim.lease}`)));
    for (const [index, claim] of claims.entries()) assert.equal(git(bare, 'show', `refs/heads/agents/codex-1/${claim.lease}:a.txt`), String(index + 2));
    assert.equal(git(clone, 'branch', '--show-current'), 'main');
    assert.equal(git(clone, 'status', '--porcelain'), '');
    assert.equal(await readFile(join(clone, 'a.txt'), 'utf8'), '1\n');
  } finally {
    server.close();
    await rm(root, { recursive: true, force: true });
  }
});
