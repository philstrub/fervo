/**
# Server Extension Host

The API a server extension registers with, and the registry it fills.

## 1. What This Module Does
Defines `ServerAPI`: policy rules, write gates and event listeners. Registers the built-in policy rules as
`builtin:rules`, loads the extensions named in `<root>/.fervo/settings.json`, and checks that every rule
`fervo.toml` requires on `main` is registered.
## 2. Why This Module Exists
`State` evaluated a fixed table of rules and offered no other seam; it now runs whatever the operator's
settings register.
## 3. How It Fits in the Architecture
`fervo serve` awaits `loadServerExtensions` before it listens and hands the result to
`createFervoServer`, which gives it to `State`. `State` runs the rules and gates inside its write
transactions and calls the listeners after they commit.
## 4. Key Concepts
- **Rules** (`registerRule`) decide whether a verified node may merge. A name may be registered once; the
  one exception is replacing a built-in, where the later registration wins, as in Pi. Rules are pure and
  synchronous: they run inside the SQLite write transaction.
- **Gates** (`gate('claim' | 'submit', check)`) run in that transaction after Fervo's own checks and
  before anything is written. A gate refuses by throwing, and any throw refuses (fail closed): the client
  gets 403 with the gate's specifier and message. Gates are synchronous; `read` runs only reads.
- **Listeners** (`on(type | '*', listener)`) are notifications: called once per event after its write
  commits, in event order. A listener's error is logged and never affects the write.
## 5. Rule Names
`fervo.toml` names rules by string, and a change to a pinned path also needs `tests` and `human`. A name
nothing registers stops `serve` at startup. It is not checked
at `init`: the root does not exist before `init`, so no extension can be configured yet.
*/
import { join } from 'node:path';
import type { z } from 'zod';
import { mainConfig } from '../config.js';
import { loadExtensions, serverSettings, type Extension } from '../loader.js';
import type { Actor, ClaimIn, Event, SubmitIn } from '../models.js';
import { builtInPolicyRules, type PolicyRule } from '../plugins.js';
import { requirements } from '../policy.js';

export type Read = { get(sql: string, ...params: unknown[]): unknown; all(sql: string, ...params: unknown[]): unknown[] };
export type GateInput = { claim: z.output<typeof ClaimIn>; submit: z.output<typeof SubmitIn> };
export type GateKind = keyof GateInput;
export type Gate<K extends GateKind> = (actor: z.output<typeof Actor>, input: GateInput[K], read: Read) => void;
export type Listener = (event: z.output<typeof Event>, read: Read) => void | Promise<void>;
export interface ServerAPI {
  registerRule(rule: PolicyRule): void;
  gate<K extends GateKind>(kind: K, check: Gate<K>): void;
  on(type: string, listener: Listener): void;
}
export type ServerExtensions = {
  rules: Record<string, PolicyRule>;
  gates: { [K in GateKind]: { source: string; check: Gate<K> }[] };
  listeners: { source: string; type: string; listener: Listener }[];
  loaded: string[];
};

export const serverBuiltins: Record<string, Extension<ServerAPI>> = {
  'builtin:rules': fervo => { for (const rule of Object.values(builtInPolicyRules)) fervo.registerRule(rule); },
};

// What `State` runs with when nothing is loaded: the built-in rules, no gates, no listeners.
export const builtinServerExtensions: ServerExtensions = { rules: builtInPolicyRules, gates: { claim: [], submit: [] }, listeners: [], loaded: ['builtin:rules'] };

export async function loadServerExtensions(root: string): Promise<ServerExtensions> {
  const extensions: ServerExtensions = { rules: {}, gates: { claim: [], submit: [] }, listeners: [], loaded: [] };
  const owners: Record<string, string> = {};
  const host = (source: string): ServerAPI => ({
    registerRule(rule) {
      const earlier = owners[rule.name];
      if (earlier && !earlier.startsWith('builtin:')) throw new Error(`rule ${rule.name} is already registered by ${earlier}`);
      extensions.rules[rule.name] = rule; owners[rule.name] = source;
    },
    gate(kind, check) {
      if (!(kind in extensions.gates)) throw new Error(`unknown gate ${kind}: gates are ${Object.keys(extensions.gates).join(', ')}`);
      (extensions.gates[kind] as { source: string; check: typeof check }[]).push({ source, check });
    },
    on(type, listener) { extensions.listeners.push({ source, type, listener }); },
  });
  extensions.loaded = await loadExtensions(host, serverBuiltins, serverSettings(root), join(root, '.fervo'));
  const config = mainConfig(join(root, 'repo.git'));
  const unknown = [...new Set([...config.merge.main.require, ...config.merge.rules.flatMap(rule => rule.require), ...requirements(config, config.pinned.paths)])].filter(name => !(name in extensions.rules));
  if (unknown.length) throw new Error(`fervo.toml on main requires rules nothing registers: ${unknown.join(', ')} (registered: ${Object.keys(extensions.rules).join(', ')})`);
  return extensions;
}
