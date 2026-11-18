# Extensions

An extension is a TypeScript or JavaScript module whose default export receives a host API and registers hooks. The server and the runner are the two hosts. Fervo's own rules, job producers and model providers are registered through the same APIs, as built-ins an extension can replace or disable.

Most deployments need none: policy is `fervo.toml`, and the judge and review prompts are template files. Write an extension when the behaviour itself must change: a quota, a notification, a sandbox, another model vendor, another merge requirement.

```ts
// A server extension
import type { ServerAPI } from 'fervo/extension';
export default (fervo: ServerAPI): void => { /* fervo.registerRule, fervo.gate, fervo.on */ };

// A runner extension
import type { RunnerAPI } from 'fervo/extension';
export default (fervo: RunnerAPI): void => { /* fervo.registerProducer, registerProvider, wrapModel, exec */ };
```

The default export may be `async`. `fervo/extension` exports types only; Node strips the import, so a copied `.ts` file runs without `fervo` installed beside it (installing it, `npm i fervo` where the file lives, gives you type checking).

## Loading

| | Server | Runner |
|---|---|---|
| Where the list is | `<root>/.fervo/settings.json`: `{"extensions": [...], "disable": [...]}` | `fervo runner --extension <spec>` (repeatable) and `--disable <name>` |
| Specs resolve from | `<root>/.fervo/` | the runner's working directory |
| Built-ins | `builtin:rules` | `builtin:producers`, `builtin:anthropic`, `builtin:openai`, `builtin:token-log` |
| Logged at start | `[serve] listening on …, extensions <loaded>` | `[runner] extensions <loaded>` |

- A spec is a Node module specifier: a path (`./ext/limits.ts`) or a package installed there with `npm i`. `.ts` files load through Node's type stripping, which does not apply inside `node_modules`, so a published package ships JavaScript.
- **Order**: the built-ins first, minus those disabled, then the listed extensions in order.
- **Failure stops startup**, naming the spec: a missing module, a throw, a default export that is not a function, a duplicate name, an unknown settings key, an unknown name in `disable`. Unlike harnesses that warn and skip, Fervo fails closed: a rule that silently failed to load would relax merging.
- **Names**: a rule, producer or provider name is registered once. Registering a built-in's name replaces the built-in (the later registration wins); registering another extension's name is an error.
- **Trust**: extensions run inside the host process with its access (the server's database and repository; the runner's keys). They load only from operator files, never from the managed repository, which agents write.

## Server API

| Hook | Kind | Runs |
|---|---|---|
| `registerRule({name, evaluate})` | decision | when a verified node is checked for merging, for each requirement `fervo.toml` names |
| `gate('claim' \| 'submit', (actor, input, read) => void)` | gate | inside the write transaction, after Fervo's own checks, before anything is written |
| `on(type \| '*', (event, read) => void)` | notification | once per event, in order, after its write commits |

### Rules

`evaluate(node, verdicts, config)` returns one of:

| Decision | Effect |
|---|---|
| `{state: 'satisfied'}` | the next requirement is checked; when all are satisfied, the node merges |
| `{state: 'pending', job?: kind}` | evaluation stops; with `job`, a job of that kind is queued once (the built-in `review` queues `review`) |
| `{state: 'hold', reason}` | evaluation stops; the node stays `verified` for a human to merge or veto |
| `{state: 'failed', reason}` | the node is `rejected` with the reason |

`node` is `{outcome, changed_paths, scope}`; `verdicts` are `{producer, passed, evidence}` with `passed` 1, 0 or null; `config` is `fervo.toml` on `main`. Requirements are evaluated in the order `fervo.toml` lists them, and the first decision that is not `satisfied` ends the evaluation. Rules run inside the write transaction, so they are pure and synchronous.

A requirement name in `fervo.toml` that nothing registers stops `serve` at startup. The built-ins are `tests`, `frontier_gain`, `review`, `scope` and `human` ([Configuration](configuration.md#requirements)). This one makes `human` need two passing human reviews:

```ts
import type { ServerAPI } from 'fervo/extension';
export default (fervo: ServerAPI): void => {
  fervo.registerRule({ name: 'human', evaluate: (_node, verdicts) => {
    const humans = verdicts.filter(v => v.producer === 'human');
    if (humans.some(v => v.passed === 0)) return { state: 'failed', reason: humans.find(v => v.passed === 0)!.evidence };
    return humans.length >= 2 ? { state: 'satisfied' } : { state: 'pending' };
  } });
};
```

### Gates

A gate refuses by throwing, and any throw refuses: the client gets 403 `"<claim|submit> refused by <spec>: <message>"`, and nothing is written. Gates are synchronous; an `async` gate is refused as a bug, since it would decide after the write. `actor` is the `Actor`, and `input` the parsed `ClaimIn` or `SubmitIn`. `read.get(sql, ...params)` and `read.all(sql, ...params)` run read-only SQL against the state database; a write statement throws, which refuses the call. A replayed write returns its stored response without running gates.

```ts
import type { ServerAPI } from 'fervo/extension';
export default (fervo: ServerAPI): void => {
  fervo.gate('claim', (actor, _input, read) => {
    if (read.get("SELECT 1 FROM claims WHERE holder=? AND state='active'", actor.id)) throw new Error('one open claim per actor');
  });
};
```

There is no gate on job leases: a refused lease would stop the runner, and quotas on model spend belong in runner middleware.

### Listeners

A listener gets the event as `GET /events` returns it (`{seq, at, actor, type, subject, data}`) and the same `read` handle. It is called after the transaction that wrote the event commits, so it never sees a write that rolled back. It may return a promise; its error, thrown or rejected, is logged as `[notify] <spec> on <type> #<seq>: …` and never affects the write. Listeners see events only while the server runs: a consumer that must not miss any follows `fervo events --after <seq>` instead.

The event types are `initialized`, `actor_created`, `actor_enrolled`, `actor_rotated`, `actor_disabled`, `grant_created`, `claim_created`, `claim_renewed`, `claim_released`, `claim_expired`, `node_submitted`, `node_state`, `node_rebased`, `needs_rebase`, `node_merged`, `node_reverted`, `node_retry`, `policy_changed`, `postmerge_failed`, `human_review`, `human_merge`, `human_veto`, `human_revert`, `human_abandon`, `job_queued`, `job_leased`, `job_done` and `job_failed`.

## Runner API

| Hook | Kind | Runs |
|---|---|---|
| `registerProducer(kind, (job, context) => verdicts)` | replacement | for each leased job of that kind: `baseline`, `eval`, `review`, `postmerge`, `claim_review` |
| `registerProvider(name, (request) => reply)` | replacement | for each model request naming that provider |
| `wrapModel(next => (request) => reply)` | middleware | around every model request; the last loaded runs first, the built-in token log is innermost |
| `exec(command => command)` | mutation | on every test and metric command, in load order, after the secrets are removed from its environment |

### Producers

A producer turns a `LeaseJob` into `RunnerVerdict[]`. Its `context` holds `config` (`fervo.toml` on `main`), `settings` (the runner's model and template flags), `node` and `parent` (worktree paths, `parent` null for jobs without one), `diff()` (parent to node, capped at 20 000 characters), `run(command, cwd, timeout)` (through the `exec` rewrites) and `model(provider, model, prompt)` (through the middleware). A producer that throws fails its job, with the message as the error: an `eval` job fails its node, a `review` job leaves it verified with `review unavailable: <message>`, and `fervo retry` runs it again.

### Model providers and middleware

A request is `{provider, model, prompt, job}`, and a reply is `{decision, usage}`: `decision` is `{passed?, preference?, evidence}`, and `usage` is `{input_tokens, output_tokens}`. `job.author` is the node's author (the claim holder for a claim review), so middleware can account per author. Middleware may change the request, the reply, or throw to refuse the call, which fails the job as above.

### Command rewrites

A command is `{command, cwd, env, timeout}`, with `timeout` in seconds; a rewrite returns the command to run and may change any field. The runner runs the result under `sh -c` in its own process group and kills the group at the timeout and when the shell exits. A process outside the group, such as a container the Docker daemon runs, outlives that kill, so a rewrite that starts one must bound it itself.

```ts
import type { RunnerAPI } from 'fervo/extension';
export default (fervo: RunnerAPI): void => {
  fervo.exec(command => ({ ...command, command: `nice -n 10 sh -c '${command.command.replaceAll("'", "'\\''")}'` }));
};
```
