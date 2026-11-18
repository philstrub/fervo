/**
# Fervo Library

The package entry point for embedding Fervo in another Node program.

## 1. What This Module Does
Re-exports the server factory, the state writer, the runner, the store and the API schemas.
## 2. Why This Module Exists
The CLI was the only way in, so nothing could embed a server, drive a runner, or type an extension.
## 3. How It Fits in the Architecture
`import { createFervoServer } from 'fervo'`. The CLI is one consumer of these exports: `serve` and
`runner` translate flags into the same calls. Extension types live in `fervo/extension`.
## 4. Key Concepts
Exports are the public API from 0.2.0 on; anything not exported here is internal.
*/
export { createFervoServer } from './server/http.js';
export { loadServerExtensions, serverBuiltins, builtinServerExtensions } from './server/extensions.js';
export { loadExtensions, serverSettings, writeDefaultSettings, Settings } from './loader.js';
export { builtInPolicyRules } from './plugins.js';
export { State } from './server/state.js';
export { openDb, migrate, migrations } from './store/db.js';
export { runRunner, executeJob, readSettings } from './runner/run.js';
export { ModelDecision, anthropic, openai, tokenLog } from './runner/models.js';
export { loadRunnerExtensions, runnerBuiltins, modelChain } from './runner/extensions.js';
export { builtInProducers } from './runner/producers.js';
export { Config, mainConfig } from './config.js';
export { FervoError } from './errors.js';
export * from './models.js';
