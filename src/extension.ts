/**
# Fervo Extension Types

The types an extension module is written against.

## 1. What This Module Does
Re-exports the contracts an operator implements: the two host APIs (`ServerAPI`, `RunnerAPI`), and what
they register: policy rules, gates, listeners, producers, model providers and middleware, command rewrites.
## 2. Why This Module Exists
An extension is typed with `import type { ... } from 'fervo/extension'`, not by reaching into `dist/`.
## 3. How It Fits in the Architecture
A types-only entry point beside `fervo`. An extension module's default export receives one of the two APIs.
## 4. Key Concepts
Nothing here has a runtime value; importing it costs nothing.
*/
export type { PolicyRule, PolicyNode, PolicyVerdict, PolicyDecision } from './plugins.js';
export type { ModelCall, ModelRequest, ModelReply, ModelMiddleware } from './runner/models.js';
export type { Producer, ProducerContext, RunnerSettings } from './runner/producers.js';
export type { RunnerAPI, Command, CommandRewrite } from './runner/extensions.js';
export type { Config } from './config.js';
export type { ServerAPI, Gate, GateKind, GateInput, Listener, Read } from './server/extensions.js';
export type { Extension } from './loader.js';
