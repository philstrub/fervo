/**
# Fervo Plugin Contracts

Policy rule contract and the built-in merge requirements.

## 1. What This Module Does
Defines the policy rule shape and the five built-in rules. Verdict producers live in `src/runner/producers.ts`.
## 2. Why This Module Exists
Specialized checks should add evidence or rules without changing the state machine.
## 3. How It Fits in the Architecture
The server evaluates pure policy rules; runner-owned producers hold keys and execute checks.
## 4. Key Concepts
Pending means more evidence is needed; hold means no automatic promotion is allowed. `scope` compares
the changed paths with the claim's scope using the same patterns as pinned paths; it is opt-in, like every
rule, by naming it in `require`.
*/
import type { Config } from './config.js';
import { matches } from './policy.js';

export type PolicyNode = { outcome: string | null; changed_paths: string[]; scope: string[] };
export type PolicyVerdict = { producer: string; passed: number | null; evidence: string };
export type PolicyDecision = { state: 'satisfied' } | { state: 'pending'; job?: string } | { state: 'hold'; reason: string } | { state: 'failed'; reason: string };
export interface PolicyRule { name: string; evaluate(node: PolicyNode, verdicts: PolicyVerdict[], config: Config): PolicyDecision }

const satisfied: PolicyDecision = { state: 'satisfied' };
export const builtInPolicyRules: Record<string, PolicyRule> = {
  tests: { name: 'tests', evaluate: (_node, verdicts) => { const test=verdicts.find(v=>v.producer==='tests'); return !test?{state:'pending'}:test.passed===1?satisfied:{state:'failed',reason:test.evidence}; } },
  frontier_gain: { name: 'frontier_gain', evaluate: node => node.outcome==='improved'?satisfied:{state:'hold',reason:`gain is ${node.outcome}` } },
  review: { name: 'review', evaluate: (_node, verdicts) => { const review=verdicts.find(v=>v.producer==='review'); return !review?{state:'pending',job:'review'}:review.passed===1?satisfied:{state:'failed',reason:review.evidence}; } },
  scope: { name: 'scope', evaluate: node => { const outside=node.changed_paths.filter(path=>!node.scope.some(pattern=>matches(path,pattern))); return outside.length?{state:'failed',reason:`changed paths outside the claim's scope: ${outside.join(', ')}`}:satisfied; } },
  human: { name: 'human', evaluate: (_node, verdicts) => { const human=verdicts.find(v=>v.producer==='human'); return !human?{state:'pending'}:human.passed===1?satisfied:{state:'failed',reason:human.evidence}; } },
};
