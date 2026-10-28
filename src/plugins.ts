/**
# Fervo Plugin Contracts

Extension seams for evidence, policy, context, and optional views.

## 1. What This Module Does
Defines the four plugin shapes and the built-in merge requirement rules.
## 2. Why This Module Exists
Specialized checks should add evidence or rules without changing the state machine.
## 3. How It Fits in the Architecture
The server evaluates pure policy rules; runner-owned producers hold keys and execute checks.
## 4. Key Concepts
Pending means more evidence is needed; hold means no automatic promotion is allowed.
*/
import type { Config } from './config.js';
import type { z } from 'zod';
import type { LeaseJob, RunnerVerdict } from './models.js';
import type { ModelCall } from './runner/models.js';

export type PolicyNode = { outcome: string | null };
export type PolicyVerdict = { producer: string; passed: number | null; evidence: string };
export type PolicyDecision = { state: 'satisfied' } | { state: 'pending'; job?: string } | { state: 'hold'; reason: string } | { state: 'failed'; reason: string };
export interface PolicyRule { name: string; evaluate(node: PolicyNode, verdicts: PolicyVerdict[], config: Config): PolicyDecision }
export interface VerdictProducer { name: string; jobKind: string; run(job: z.output<typeof LeaseJob>, workspace: string, model: ModelCall): Promise<z.output<typeof RunnerVerdict>[]> }
export interface ContextProvider { name: string; contribute(actor: string, query: { scopes: string[] }, db: { prepare(sql: string): unknown }): Record<string, unknown> }
export interface View { name: string; render(path: string): { status: number; html: string } }

const satisfied: PolicyDecision = { state: 'satisfied' };
export const builtInPolicyRules: Record<string, PolicyRule> = {
  tests: { name: 'tests', evaluate: (_node, verdicts) => { const test=verdicts.find(v=>v.producer==='tests'); return !test?{state:'pending'}:test.passed===1?satisfied:{state:'failed',reason:test.evidence}; } },
  frontier_gain: { name: 'frontier_gain', evaluate: node => node.outcome==='improved'?satisfied:{state:'hold',reason:`gain is ${node.outcome}` } },
  review: { name: 'review', evaluate: (_node, verdicts) => { const review=verdicts.find(v=>v.producer==='review'); return !review?{state:'pending',job:'review'}:review.passed===1?satisfied:{state:'failed',reason:review.evidence}; } },
  human: { name: 'human', evaluate: (_node, verdicts) => { const human=verdicts.find(v=>v.producer==='human'); return !human?{state:'pending'}:human.passed===1?satisfied:{state:'failed',reason:human.evidence}; } },
};
