/**
# Repository Policy Configuration

The operator's committed goal and rules for a single managed repository.

## 1. What This Module Does
Validates the committed TOML contract that guides measurement and merging.
## 2. Why This Module Exists
Agent submissions must be evaluated against the operator's policy on main.
## 3. How It Fits in the Architecture
The server and runner read the same pinned main-branch configuration.
## 4. Key Concepts
Metrics are positive measurements; path rules can tighten or relax default merge requirements.
*/
import { parse } from 'smol-toml';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';

const command = z.object({ cmd: z.string().min(1), timeout: z.string().default('10m') });
export const Config = z.object({
  goal: z.object({ text: z.string().min(1) }),
  tests: command,
  metrics: z.array(z.object({ name: z.string().min(1), cmd: z.string().min(1), direction: z.enum(['max', 'min']), weight: z.number().positive(), timeout: z.string().default('10m') })).min(1),
  judge: z.object({ template: z.string().min(1), weight: z.number().min(0).max(1) }).optional(),
  eval: z.object({ samples: z.number().int().positive().default(3), baseline_samples: z.number().int().positive().default(5) }).default({ samples: 3, baseline_samples: 5 }),
  context: z.object({ tried_ttl: z.string().default('7d') }).default({ tried_ttl: '7d' }),
  pinned: z.object({ paths: z.array(z.string()).default([]) }).default({ paths: [] }),
  merge: z.object({ main: z.object({ mode: z.literal('verify_then_merge').default('verify_then_merge'), require: z.array(z.enum(['tests', 'frontier_gain', 'review', 'human'])).default(['tests', 'frontier_gain', 'review']), human_override: z.boolean().default(true) }), rules: z.array(z.object({ paths: z.array(z.string()).min(1), require: z.array(z.enum(['tests', 'frontier_gain', 'review', 'human'])) })).default([]) }),
  review: z.object({ profile: z.literal('basic').default('basic'), model: z.string().min(1) }).optional(),
});
export type Config = z.output<typeof Config>;

export function mainConfig(repo: string): Config {
  const result = spawnSync('git', ['--git-dir', repo, 'show', 'refs/heads/main:fervo.toml'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`main must contain a valid fervo.toml: ${result.stderr}`);
  return Config.parse(parse(result.stdout));
}

export function duration(text: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(text);
  if (!match) throw new Error(`invalid duration ${text}`);
  return Number(match[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
}
