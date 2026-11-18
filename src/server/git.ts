/**
# Managed Git Repository

The server's controlled access to the bare repository and smart HTTP transport.

## 1. What This Module Does
Runs Git operations, serves smart HTTP, and checks push ref ownership.
## 2. Why This Module Exists
Agents may publish work branches, while only policy may move main.
## 3. How It Fits in the Architecture
HTTP authenticates first; the pre-receive hook enforces permissions again at ref update.
## 4. Key Concepts
Main moves with update-ref compare-and-swap; node refs are immutable pointers.
*/
import { spawn, spawnSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { writeFileSync, chmodSync } from 'node:fs';

export function bareGit(repo: string, ...args: string[]): string {
  const result = spawnSync('git', ['--git-dir', repo, ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]}: ${result.stderr.trim()}`);
  return result.stdout.trimEnd();
}

export function checkPush(actor: string, kind: string, input: string): void {
  if (kind !== 'agent' && kind !== 'human') throw new Error(`${kind} cannot push`);
  const prefix = `refs/heads/${kind === 'agent' ? 'agents' : 'humans'}/${actor}/`;
  for (const line of input.trim().split('\n')) {
    const ref = line.split(' ')[2];
    if (!ref?.startsWith(prefix) || ref.length === prefix.length) throw new Error(`push denied: ${ref}`);
  }
}

export async function gitHttp(req: IncomingMessage, res: ServerResponse, root: string, actor: string, kind: string): Promise<void> {
  const url = new URL(req.url!, 'http://localhost');
  const path = url.pathname.replace(/^\/git/, '');
  const child = spawn('git', ['http-backend'], { env: { ...process.env, GIT_PROJECT_ROOT: root, GIT_HTTP_EXPORT_ALL: '1', PATH_INFO: path, QUERY_STRING: url.search.slice(1), REQUEST_METHOD: req.method!, CONTENT_TYPE: String(req.headers['content-type'] ?? ''), CONTENT_LENGTH: String(req.headers['content-length'] ?? ''), REMOTE_USER: actor, FERVO_ACTOR_KIND: kind, GIT_PROTOCOL: String(req.headers['git-protocol'] ?? '') }, stdio: ['pipe', 'pipe', 'pipe'] });
  req.pipe(child.stdin);
  let header = Buffer.alloc(0);
  let started = false;
  child.stdout.on('data', (chunk: Buffer) => {
    if (started) { res.write(chunk); return; }
    header = Buffer.concat([header, chunk]);
    const end = header.indexOf('\r\n\r\n') >= 0 ? header.indexOf('\r\n\r\n') + 4 : header.indexOf('\n\n') >= 0 ? header.indexOf('\n\n') + 2 : -1;
    if (end < 0) return;
    const head = header.subarray(0, end).toString();
    for (const line of head.split(/\r?\n/)) {
      if (!line) continue;
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const name = line.slice(0, separator);
      const value = line.slice(separator + 1).trim();
      if (name.toLowerCase() === 'status') res.statusCode = Number(value.slice(0, 3));
      else res.setHeader(name, value);
    }
    started = true;
    res.write(header.subarray(end));
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  await new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => { if (code !== 0 && !started) reject(new Error(`git http-backend: ${stderr}`)); else { res.end(); resolve(); } });
  });
}

export function installHook(root: string, executable: string): void {
  const hook = join(root, 'repo.git', 'hooks', 'pre-receive');
  writeFileSync(hook, `#!/bin/sh\nexec "${process.execPath}" "${executable}" hook pre-receive\n`);
  chmodSync(hook, 0o755);
}
