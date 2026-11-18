/**
# Git Transport

The local CLI's bridge to the system Git binary.

## 1. What This Module Does
Runs Git commands and returns stdout while passing diagnostics to stderr.
## 2. Why This Module Exists
Git remains the source-control transport; Fervo does not duplicate it.
## 3. How It Fits in the Architecture
Clone, checkout, submit, and remote discovery all use this boundary.
## 4. Key Concepts
A failed Git command is a command error, and stdout stays available for JSON output.
*/
import { spawnSync } from 'node:child_process';

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed with exit ${result.status}`);
  return result.stdout.replace(/\n$/, '');
}
