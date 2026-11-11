/**
# Scoring and Policy Invariants

Small pure checks where a mistake can silently change promotion decisions.

## 1. What This Module Does
Checks normalization, confidence intervals, path rules, and overlapping scopes.
## 2. Why This Module Exists
These decisions should be exact before Git and HTTP behavior is involved.
## 3. How It Fits in the Architecture
Integration tests cover lifecycle; these cases pin the mathematical and policy semantics.
## 4. Key Concepts
Noise expands the interval; path requirements are unioned across changed files.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../src/config.js';
import { normalized, summarize } from '../src/scoring.js';
import { requirements, scopesOverlap } from '../src/policy.js';
import { checkPush } from '../src/server/git.js';
import { builtInPolicyRules } from '../src/plugins.js';

test('paired gain distinguishes improvement, regression and baseline noise',()=>{
  assert.equal(normalized(12,10,'max'),1.2);
  assert.equal(normalized(8,10,'min'),1.25);
  assert.equal(summarize([.2,.2,.2],0).outcome,'improved');
  assert.equal(summarize([-.2,-.2,-.2],0).outcome,'worse');
  assert.equal(summarize([.2,.2,.2],.2).outcome,'within_noise');
  assert.throws(()=>normalized(0,10,'max'));
});

test('hook rejects runner pushes and foreign refs',()=>{
  const line='0000000000000000000000000000000000000000 abc refs/heads/agents/a/l_1';
  assert.throws(()=>checkPush('runner','runner',line));
  assert.throws(()=>checkPush('b','agent',line));
  assert.doesNotThrow(()=>checkPush('a','agent',line));
});

test('path rule requirements union across files and scope prefixes overlap',()=>{
  const config=Config.parse({goal:{text:'goal'},tests:{cmd:'true'},metrics:[{name:'m',cmd:'echo 1',direction:'max',weight:1}],pinned:{paths:['fervo.toml']},merge:{main:{require:['tests','review']},rules:[{paths:['docs/**'],require:['tests']},{paths:['src/auth/**'],require:['human']}]}});
  assert.deepEqual([...requirements(config,['docs/readme.md'])],['tests']);
  assert.deepEqual([...requirements(config,['docs/readme.md','src/auth/login.ts'])],['tests','human']);
  assert.equal(scopesOverlap(['src/'],['src/auth/'],[]),true);
  assert.equal(scopesOverlap(['src/*.ts'],['src/main.ts'],['src/main.ts']),true);
  assert.equal(scopesOverlap(['src/'],['docs/'],[]),false);
});

test('human rule rejects on a failing verdict instead of waiting forever',()=>{
  const config=Config.parse({goal:{text:'goal'},tests:{cmd:'true'},metrics:[{name:'m',cmd:'echo 1',direction:'max',weight:1}],pinned:{paths:['fervo.toml']},merge:{main:{require:['human']}}});
  const human=builtInPolicyRules.human!;
  assert.deepEqual(human.evaluate({outcome:'improved'},[],config),{state:'pending'});
  assert.deepEqual(human.evaluate({outcome:'improved'},[{producer:'human',passed:0,evidence:'breaks login'}],config),{state:'failed',reason:'breaks login'});
  assert.deepEqual(human.evaluate({outcome:'improved'},[{producer:'human',passed:1,evidence:'looks good'}],config),{state:'satisfied'});
});
