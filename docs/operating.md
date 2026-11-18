# Operating Fervo

## Prepare the source repository

Commit a valid `fervo.toml` on `main` (see [Configuration](configuration.md)). Run every metric once by hand: the last line it prints must be one positive number.

## Initialize

```sh
fervo init --source ./project --root ./managed --actor operator
```

`--root` must not exist yet. `init` creates:

- `managed/repo.git`: a bare clone with a `pre-receive` hook, which `serve` reinstalls each time it starts;
- `managed/.fervo/fervo.db`: the SQLite state;
- `managed/.fervo/settings.json`: the server's extension list, copied from the package default (see [Extensions](#extensions));
- baseline node `n_0` at the current `main`, and a queued `baseline` job.

It prints `{root, actor, token, main, settings}`. **The token is shown only once.** Only its hash is stored.

## Serve

```sh
fervo serve --root ./managed --host 127.0.0.1 --port 8765
```

It logs `[serve] listening on <host>:<port>, public URL <url>, extensions <loaded>` to stderr. The listener is plain HTTP: keep it on localhost, or put it behind a TLS reverse proxy ([recipe: Caddy](recipes/tls.md)) and give that proxy's address:

```sh
fervo serve --root ./managed --host 127.0.0.1 --port 8765 --public-url https://fervo.example.org
```

- `--public-url` is where clones fetch and push Git. It is required when `--host` is not `127.0.0.1` or `localhost`, and defaults to `http://<host>:<port>` when it is.
- `GET /healthz` answers 200 without a token, for the proxy's or the supervisor's health check.
- Request bodies over 1 MB are refused with 413 (Git pushes are streamed and have no limit).
- SIGTERM stops accepting connections, lets open requests finish (a long poll takes up to 30 s), closes the database, and exits.

## Extensions

`serve` loads the extensions listed in `managed/.fervo/settings.json` before it listens. `init` writes the default file, which ships with the package as `settings.default.json`; `serve` writes the same default into a root that has none:

```json
{
  "extensions": [],
  "disable": []
}
```

- `extensions`: Node module specifiers, resolved from `managed/.fervo/`. Either a path, such as `./ext/two-humans.ts`, or a package installed there with `npm i <package>`. `.ts` files load through Node's type stripping, which does not apply to files inside `node_modules`.
- `disable`: built-ins to leave out. The server has one, `builtin:rules`: the five requirements in [Configuration](configuration.md#requirements).

An extension's default export receives the server API: `registerRule` adds or replaces a merge requirement that `fervo.toml` can name, `gate('claim' | 'submit')` refuses writes, and `on(type)` hears events after they commit. [Extensions](extensions.md) documents each hook, the load order and the failure rules. In short:

- Any failure stops `serve` with the extension's specifier, and so does a requirement in `fervo.toml` that nothing registers: a rule that failed to load would otherwise relax merging without anyone noticing.
- Extensions load only from the operator's root, never from the managed repository, which agents write.

### Notifications

Two ways to hear about events such as `node_merged`, `needs_rebase` or `postmerge_failed`:

- **In the server**: a server extension's listener (`fervo.on(type, …)`, [Extensions](extensions.md#listeners)) can POST each event to a webhook. It holds no token, but delivery is at most once: a failed POST is logged as `[notify]` and not retried, and nothing is sent while the server is down.
- **Outside the server**: follow the event log from a cursor, in a human clone:

```sh
FERVO_TOKEN=<your token> fervo events --after 0 --follow \
  | jq -c --unbuffered 'select(.type == "node_merged" or .type == "needs_rebase")' \
  | while read -r event; do curl -sS -X POST -H 'Content-Type: application/json' --data-binary "$event" "$FERVO_WEBHOOK_URL"; done
```

After a restart, pass the last `seq` delivered as `--after`, and nothing is missed. Without `--unbuffered`, `jq` holds events back until its buffer fills. `fervo events` needs a human token, which carries full human powers: run this as its own service, not in a shell an agent can read.

## Actors

Clone with the human token. `clone` prompts for it and never stores it; the clone holds an enroller token instead, and every `claude` session started in it enrolls as its own agent actor, `<you>-<session>`. Human commands prompt for the token each time, or take `FERVO_TOKEN=<token>` for one command. Run `fervo delegate` to start a Claude Code session with human powers.

```sh
fervo clone http://127.0.0.1:8765 ./op
cd op
claude                                    # an agent session: no actor add needed
fervo actor add runner --kind runner --key add-runner
fervo actor add claude-1 --kind agent --provider anthropic --model <model-id> --harness claude-code --key add-claude-1
fervo actor add alice --kind human --key add-alice
fervo actor list
fervo actor disable claude-1 --key disable-claude-1
```

- IDs use lowercase letters, digits and `-`, and must start with a letter or digit.
- Set `--provider` on agents. It decides which provider judges their nodes.
- Each `actor add` prints the new token once. A disabled token is refused with HTTP 401.
- Only humans can add, list or disable actors.

For another harness, either clone with your human token and `--harness <name>` and have the harness's session-start hook run `fervo enroll --session <session-id>` in the clone, then give the session the printed token as `FERVO_TOKEN`; or give each agent its own token through `FERVO_TOKEN` or `--token`, and have it run `fervo clone`. The token ends up in the clone's `.git/config`, never in the working tree.

For pi, the session-start hook is an extension (`~/.pi/agent/extensions/fervo.ts`, or `pi -e`). It was written against pi's extension docs (`@earendil-works/pi-coding-agent` 1.5) and is not tested in Fervo's CI. pi's bash tool passes `process.env` to every command, which is how the token reaches `fervo`; that behaviour is pi's source, not its documented API.

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const r = await pi.exec("fervo", ["enroll", "--session", ctx.sessionManager.getSessionId()], { cwd: ctx.cwd, timeout: 10_000 });
    if (r.code !== 0) { ctx.ui.notify(`fervo enroll failed: ${r.stderr}`, "error"); return; }
    process.env.FERVO_TOKEN = JSON.parse(r.stdout).token;
  });
}
```

It runs again on `/new`, `/resume` and `/fork`, and each run rotates the token. Start pi without `FERVO_TOKEN` in its environment, or the enrollment is refused. Enrolled sessions appear in `actor list` with their `owner` and `session`; `actor disable` revokes one.

## Run the runner

```sh
FERVO_TOKEN=<runner-token> ANTHROPIC_API_KEY=<key> OPENAI_API_KEY=<key> \
  fervo runner --remote http://127.0.0.1:8765 \
  --judge-template /operator/judge.txt --review-template /operator/review.txt \
  --anthropic-model <id> --openai-model <id> \
  --review-provider anthropic --review-model <id> --concurrency 2
```

- The first job is the baseline. An evaluation that runs before any baseline exists fails with `baseline missing`, and `fervo retry` re-queues it.
- Each worker keeps a mirror clone and runs every job in temporary worktrees.
- Commands run under `sh -c`, without `FERVO_TOKEN` or the API keys in their environment, each in its own process group. At its timeout the whole group is killed and the job fails with `command timed out after <timeout>`; when the command exits, anything it left running in the background is killed too. Stopping the runner with Ctrl-C or SIGTERM kills the running commands' groups first.
- Jobs queue while the runner is offline and resume when it returns.
- Keep the templates outside the managed repository, so agents cannot read how they are judged.
- The model flags are needed only by the jobs that call a model: `--judge-template` and the judge's `--<provider>-model` when `fervo.toml` has a `[judge]`, the three `--review-*` flags for `review` and `claim_review` jobs. A job that needs a missing flag fails with `runner flag <flag> is required: …`; restart the runner with it and `fervo retry` the node.

The runner executes agent-written code. Run it in a container or VM that holds only what it needs. See [Security](security.md).

### Runner extensions

`--extension <spec>` (repeatable) loads a runner extension, resolved from the runner's working directory; `--disable <name>` leaves out a built-in. The runner logs `[runner] extensions <loaded>` before it leases. A runner extension can replace the producer of a job kind or a model provider, wrap every model call, and rewrite every test and metric command ([Extensions](extensions.md#runner-api)).

## Human controls

Run these from a human clone, in your own terminal or a `fervo delegate` session. Each one is recorded as a verdict and an event, with its reason.

```sh
fervo review <node> --pass|--fail --evidence "<text>" --key <k>   # evidence for policy; --pass can trigger a merge
fervo merge  <node> --reason "<text>" --key <k>    # override: merge a verified node (needs human_override)
fervo veto   <node> --reason "<text>" --key <k>    # mark abandoned (open nodes only; merged nodes take revert)
fervo revert <node> --reason "<text>" --key <k>    # move main back to the node's parent
fervo retry  <node> --key <k>                      # re-evaluate a failed node
fervo abandon <node> --reason "<text>" --key <k>   # humans may abandon any node
fervo baseline --key <k>                           # re-measure main, e.g. after a hardware change
```

On a node that changes a pinned path, `review`, `merge` and `revert` need your own token: a `fervo delegate` session gets `a delegated session cannot approve a policy change`.

- `merge` needs a `verified` node whose parent is still `main`. Otherwise the server rebases it onto `main` as a successor node and queues a fresh evaluation, or reports `needs_rebase` when the rebase conflicts.
- `revert` works only on the node that is currently the head of `main`. On an older node it fails with `only the head of main can be reverted`.

## Change the policy

`fervo.toml` and the other pinned paths change through a node, like code, but only from your own human token: an agent's node or a `fervo delegate` session's node that touches a pinned path is rejected at submit. From a human clone, in your own terminal, pass the token to each command rather than exporting it, so no harness started from that shell inherits it:

```sh
FERVO_TOKEN=<your token> fervo claim --parent <main node> --scope fervo.toml --intent "weigh latency twice" --checkout --key policy-1
cd .fervo/worktrees/<lease> && $EDITOR fervo.toml && git commit -am "Weigh latency twice"
FERVO_TOKEN=<your token> fervo submit --lease <lease> --key policy-2
fervo status <node> --wait                                   # tests run; the node waits as verified
fervo review <node> --pass --evidence "weight reviewed" --key policy-3
```

The node needs the requirements in [Configuration](configuration.md#requirements): `tests` and your verdict, by default. Its evaluation runs under the old policy; the server and the runner read `fervo.toml` from `main` on every call and job, so the next evaluation uses the new one. The merge records a `policy_changed` event, and when a metric was added, renamed or given a new command it also queues a new baseline. A change of weight, direction or requirements keeps the baselines. An evaluation that starts before the new baseline is measured fails with `baseline missing for <metric>`; run `fervo retry <node>` once it is. `fervo revert` of a policy node, from your own token, changes the policy back the same way.

If the server rebases a verified policy node onto a moved `main`, the successor needs its own human verdict.

## Watch the system

- `fervo context` from any clone shows the frontier, active claims and recent outcomes.
- `fervo status <node|lease|job>` shows a single object.
- The server and runner write their logs to stderr. The runner logs one `[callModel]` line per judge or review call with the provider, model and token counts, so a run's model cost can be summed from its log.
- `fervo events --follow` from a human clone tails every recorded event: claims with their overlaps, submits with rejection reasons, runner leases and verdicts, merges and reverts. One readable line per event, with `jq`:

```sh
fervo events --follow | jq -r '"\(.at[11:19])  \(.actor)  \(.type)  \(.subject)  \(.data | tostring)"'
```

## Back up and reset

All state lives under `--root`. Stop the server, copy the directory, and restart.

The database records its schema version. A newer Fervo upgrades it when it opens it, in one transaction; an older Fervo refuses a database that a newer one has upgraded. Copy the root before upgrading Fervo if you may need to go back. To change `fervo.toml`, see [Change the policy](#change-the-policy).
