/**
# Remote API

The CLI's authenticated JSON connection to Fervo's state writer.

## 1. What This Module Does
Reads clone-local connection settings and validates HTTP responses.
## 2. Why This Module Exists
Every command needs identical authentication, errors, and JSON output.
## 3. How It Fits in the Architecture
The CLI calls these functions; the server owns all state changes.
## 4. Key Concepts
The token lives in Git configuration. Writes carry an idempotency key in the request header.
*/
import { git } from './git.js';
import type { Remote } from './models.js';
import type { z } from 'zod';

export function loadRemote(cwd: string): Remote {
  const gitUrl = git(cwd, 'remote', 'get-url', 'origin');
  const header = git(cwd, 'config', '--get', `http.${gitUrl}.extraHeader`);
  if (!header.startsWith('Authorization: ')) throw new Error('invalid Fervo authorization header in Git config');
  return { url: git(cwd, 'config', '--get', 'fervo.url'), auth: header.slice('Authorization: '.length) };
}

export async function request<T extends z.ZodType>(remote: Remote, method: 'GET' | 'POST', path: string, schema: T, options: { key?: string; body?: unknown; params?: URLSearchParams } = {}): Promise<z.output<T>> {
  const url = new URL(path, remote.url);
  if (options.params) url.search = options.params.toString();
  const response = await fetch(url, {
    method,
    headers: { Authorization: remote.auth, ...(options.key === undefined ? {} : { 'Idempotency-Key': options.key }), ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(35_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  return schema.parse(JSON.parse(body));
}

export function emit(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, process.stdout.isTTY ? 2 : undefined)}\n`);
}
