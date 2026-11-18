/**
# Runner Extension Host

The API a runner extension registers with, and the registry it fills.

## 1. What This Module Does
Defines `RunnerAPI`: verdict producers, model providers, model middleware and command rewrites. Registers
the built-ins (`builtin:producers`, `builtin:anthropic`, `builtin:openai`, `builtin:token-log`) and loads
the extensions named by `fervo runner --extension`.
## 2. Why This Module Exists
Extra review stages, other model vendors, cost caps and sandboxes are operator choices, not core.
## 3. How It Fits in the Architecture
`fervo runner` loads the extensions once, before it leases, and `executeJob` uses the registry for every
job. Specs resolve from the runner's working directory.
## 4. Key Concepts
- **Producers** (`registerProducer(kind, produce)`) turn a leased job into verdicts. Job kinds are the
  server's fixed set; a producer replaces the built-in for its kind.
- **Providers** (`registerProvider(name, call)`) answer model requests for one provider name.
- **Middleware** (`wrapModel(next => call)`) wraps the model chain. Each registration wraps the chain built
  so far, so the last loaded runs first; the built-in token log is innermost and logs every provider call.
- **Command rewrites** (`exec(command => command)`) see every agent-authored command (tests and metrics)
  after Fervo has removed its secrets from the environment, in load order, and may change the command,
  working directory, environment and timeout (seconds): to run it in a container, for instance. A process
  the command does not own, such as a container, outlives the kill at the timeout, so a rewrite that starts
  one must bound it itself.
A producer or provider name is registered once, except that a later registration replaces a built-in.
*/
import type { Extension, Settings } from '../loader.js';
import { loadExtensions } from '../loader.js';
import { Job } from '../models.js';
import { anthropic, openai, tokenLog, type ModelCall, type ModelMiddleware } from './models.js';
import { builtInProducers, type Producer } from './producers.js';

export type Command = { command: string; cwd: string; env: NodeJS.ProcessEnv; timeout: number };
export type CommandRewrite = (command: Command) => Command;
export interface RunnerAPI {
  registerProducer(kind: string, produce: Producer): void;
  registerProvider(name: string, call: ModelCall): void;
  wrapModel(middleware: ModelMiddleware): void;
  exec(rewrite: CommandRewrite): void;
}
export type RunnerExtensions = { producers: Record<string, Producer>; providers: Record<string, ModelCall>; middleware: ModelMiddleware[]; rewrites: CommandRewrite[]; loaded: string[] };

export const runnerBuiltins: Record<string, Extension<RunnerAPI>> = {
  'builtin:producers': fervo => { for (const [kind, produce] of Object.entries(builtInProducers)) fervo.registerProducer(kind, produce); },
  'builtin:anthropic': fervo => fervo.registerProvider('anthropic', anthropic),
  'builtin:openai': fervo => fervo.registerProvider('openai', openai),
  'builtin:token-log': fervo => fervo.wrapModel(tokenLog),
};

export async function loadRunnerExtensions(settings: Settings, base: string): Promise<RunnerExtensions> {
  const extensions: RunnerExtensions = { producers: {}, providers: {}, middleware: [], rewrites: [], loaded: [] };
  const owners: Record<string, string> = {};
  const claim = (what: string, source: string) => {
    const earlier = owners[what];
    if (earlier && !earlier.startsWith('builtin:')) throw new Error(`${what} is already registered by ${earlier}`);
    owners[what] = source;
  };
  const host = (source: string): RunnerAPI => ({
    registerProducer(kind, produce) {
      if (!Job.shape.kind.options.includes(kind as never)) throw new Error(`unknown job kind ${kind}: the server queues ${Job.shape.kind.options.join(', ')}`);
      claim(`producer ${kind}`, source); extensions.producers[kind] = produce;
    },
    registerProvider(name, call) { claim(`provider ${name}`, source); extensions.providers[name] = call; },
    wrapModel(middleware) { extensions.middleware.push(middleware); },
    exec(rewrite) { extensions.rewrites.push(rewrite); },
  });
  extensions.loaded = await loadExtensions(host, runnerBuiltins, settings, base);
  return extensions;
}

export function modelChain(extensions: RunnerExtensions): ModelCall {
  const dispatch: ModelCall = async request => {
    const provider = extensions.providers[request.provider];
    if (!provider) throw new Error(`no model provider ${request.provider} (registered: ${Object.keys(extensions.providers).join(', ')})`);
    return provider(request);
  };
  return extensions.middleware.reduce<ModelCall>((next, wrap) => wrap(next), dispatch);
}
