/**
# Package Export Tests

`fervo` and `fervo/extension` resolve by package name, at runtime and for the type checker.

## 1. What This Module Does
Installs the package into a temporary directory as a symlink, the way `npm i <path>` does, imports both
entry points from Node there, and type-checks an extension module against the emitted declarations.
## 2. Why This Module Exists
`package.json` had only `bin`, so nothing could embed Fervo or type an extension.
## 3. How It Fits in the Architecture
Runs against `dist/`, after the build, from outside the repository.
## 4. Key Concepts
The consumer lives outside the package, so Node and TypeScript resolve it through `exports` and never
through relative paths into `dist/`.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('fervo and fervo/extension import by package name and type an extension',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-exports-'));
  try {
    mkdirSync(join(tmp,'node_modules'));symlinkSync(resolve('.'),join(tmp,'node_modules','fervo'),'dir');
    writeFileSync(join(tmp,'package.json'),'{"type":"module"}\n');
    writeFileSync(join(tmp,'runtime.js'),`import * as fervo from 'fervo';import * as extension from 'fervo/extension';
console.log(JSON.stringify({fervo:Object.keys(fervo).sort(),extension:Object.keys(extension)}));`);
    const runtime=spawnSync(process.execPath,['runtime.js'],{cwd:tmp,encoding:'utf8'});
    assert.equal(runtime.status,0,runtime.stderr);
    const keys=JSON.parse(runtime.stdout) as {fervo:string[];extension:string[]};
    for(const name of ['createFervoServer','State','openDb','runRunner','executeJob','Config','FervoError','ClaimIn','LeaseJob','JobResult','loadServerExtensions','loadRunnerExtensions','builtInProducers'])assert.ok(keys.fervo.includes(name),name);
    assert.deepEqual(keys.extension,[],'types only');
    writeFileSync(join(tmp,'extension.ts'),`import { createFervoServer, State, ClaimIn, FervoError } from 'fervo';
import type { PolicyRule, ModelCall, ServerAPI, RunnerAPI } from 'fervo/extension';
export const rule: PolicyRule = { name: 'small', evaluate: (_node, verdicts) => verdicts.length ? { state: 'satisfied' } : { state: 'pending' } };
export const model: ModelCall = async ({ prompt }) => ({ decision: { evidence: prompt, passed: true }, usage: { input_tokens: 1, output_tokens: 1 } });
export const server = (fervo: ServerAPI): void => { fervo.registerRule(rule); fervo.gate('claim', (actor, input) => { if (input.scope.length > 5 && actor.kind === 'agent') throw new Error('narrow it'); }); fervo.on('node_merged', event => { void event.subject; }); };
export const runner = (fervo: RunnerAPI): void => { fervo.registerProvider('local', model); fervo.wrapModel(next => request => next(request)); fervo.exec(command => ({ ...command, command: 'nice ' + command.command })); fervo.registerProducer('review', async (_job, c) => [{ producer: 'review', provider: null, passed: (await c.model('local', 'm', c.diff())).passed ?? false, samples: null, evidence: 'ok', recipe_hash: 'r' }]); };
export const claim = ClaimIn.parse({ parent: 'n_0', scope: ['src/'], intent: 'x' });
export const refuse = () => { throw new FervoError(403, 'no'); };
export type Server = ReturnType<typeof createFervoServer>;
export type Writer = State;
`);
    const types=spawnSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--noEmit','--strict','--module','nodenext','--moduleResolution','nodenext','--target','es2024','--types','node','--typeRoots',resolve('node_modules/@types'),'extension.ts'],{cwd:tmp,encoding:'utf8'});
    assert.equal(types.status,0,types.stdout+types.stderr);
  } finally { rmSync(tmp,{recursive:true,force:true}); }
});
