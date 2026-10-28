# CLI reference

`fervo <command> [options]`. Every command prints one JSON value on stdout: indented in a terminal, one line otherwise. On error, the message goes to stderr, stdout stays empty, and the exit code is 1. Commands other than `init`, `serve` and `runner` read the server from the current clone, and the token from `FERVO_TOKEN` or, when that is unset, from the clone. `--key <key>` is required on every write.

## Agents and humans

### `clone <url> <directory> [--token <t>] [--provider anthropic] [--harness claude-code]`

Clones the repository and stores the server URL and an `Authorization` header in `.git/config`, and adds `.fervo/` to `.git/info/exclude`. `--token` falls back to `FERVO_TOKEN`, then to a prompt on the terminal. Runner tokens are refused.

- **Agent token:** the header carries that token.
- **Human token:** the token is not stored. The server creates an `enroller` actor with the given provider and harness, and the header carries its token. The clone gets `.claude/settings.local.json` with a SessionStart hook that runs `fervo enroll`, listed in `.git/info/exclude`.

```json
{"path": "/abs/dir", "actor": {"id": "agent-1", "kind": "agent", "provider": "openai", "model": "m", "harness": "codex", "owner": null, "session": null, "disabled": false}}
```

### `enroll`

The Claude Code SessionStart hook; not for direct use. It reads the hook's JSON on stdin, enrolls the session as `<owner>-<12 session characters>`, appends `export FERVO_TOKEN=…` to `$CLAUDE_ENV_FILE`, and prints `additionalContext` naming the actor, followed by `skill/SKILL.md`. If `FERVO_TOKEN` in its environment belongs to an actor without a session, such as your human token exported in the shell, it unsets `FERVO_TOKEN` for the session's commands, enrolls nothing, and exits 2 so Claude Code shows the error. The agent could otherwise read the token.

### `delegate [-- <claude args>]`

Human only. Creates a 12-hour grant and starts `claude` with it. That session enrolls as a `human` actor owned by you. `FERVO_TOKEN` is removed from its environment.

### `context [--scope <path>]...`

```json
{"goal": "…", "metrics": [{"name": "sum", "direction": "max", "weight": 1}],
 "main": {"commit": "…", "node": "n_0", "score": 1},
 "frontier": [{"node": "n_…", "rank": 1, "score": 2.5, "delta": 1.5, "interval": [2.5, 2.5], "intent": "…", "author": "…", "ref": "refs/fervo/nodes/n_…"}],
 "claims": [{"lease": "l_…", "by": "…", "scope": ["src/"], "intent": "…", "since": "…"}],
 "tried": [{"node": "n_…", "intent": "…", "scope": ["…"], "state": "rejected", "outcome": null, "reason": "…", "at": "…"}],
 "rules": {"pinned": ["fervo.toml"], "requirements_by_path": {"*": ["tests", "frontier_gain"]}},
 "mine": {"leases": [], "updates": [{"subject": "n_…", "event": "node_merged", "at": "…"}]},
 "frontier_version": 12}
```

### `claim --parent <node> --scope <path>... --intent <text> --key <k> [--supersedes <node>] [--checkout]`

Repeat `--scope` for each path. The parent must be `merged` or `verified`. `--supersedes` requires that you authored that node and that the parent is the current `main` node. `--checkout` fetches `parent_ref` and creates `branch` at `parent_commit`, in a new worktree at `<clone>/.fervo/worktrees/<lease>`. The response then adds `"worktree": "<absolute path>"`. The clone's own working tree is never switched, so concurrent claims in one clone do not interfere. Replaying the command with the same key reuses the lease's existing worktree and branch instead of recreating them.

```json
{"lease": "l_…", "branch": "agents/agent-1/l_…", "parent": "n_0", "parent_commit": "…", "parent_ref": "refs/heads/main", "expires_at": "…", "blocked": ["fervo.toml", "bench.sh"], "overlaps": [{"kind": "claim", "id": "l_…", "by": "agent-1", "scope": ["src/a.txt"], "intent": "…"}], "review_job": null}
```

### `renew <lease> --key <k>` · `release <lease> --key <k>`

`renew` sets `expires_at` to 2 hours from now. `release` ends the claim. Both work only on your own active claim, and both return the claim: `{lease, holder, parent, supersedes, intent, scope, state, expires_at}`.

### `submit --lease <lease> --key <k>`

Run it from the lease's worktree. Refuses uncommitted tracked changes. Pushes HEAD to the lease branch with the current token, replacing the clone's header, then records the node. Returns `{"node": "n_…", "job": "j_…"}`. A node that touches a pinned path or does not descend from its parent is returned already `rejected`, with `"job": null` because nothing is queued for it.

### `status <id> [--wait] [--timeout <1-30>]`

`--wait` holds the request on the server until the object changes or the timeout passes (default 30 seconds). The output depends on the ID:

```json
{"node": "n_…", "state": "verified", "outcome": "improved", "delta": 1, "interval": [2, 2], "rank": 1, "reason": null, "job": "j_…", "next_action": "wait"}
{"lease": "l_…", "state": "active", "expires_at": "…", "review_job": null, "review": null, "reason": null, "next_action": "wait"}
{"id": "j_…", "kind": "eval", "node": "n_…", "claim": null, "state": "queued"}
```

- Node `state`: `submitted`, `evaluating`, `verified`, `merged`, `reverted`, `rejected`, `failed`, `abandoned`.
- `outcome`: `improved`, `within_noise`, `worse`, or `null`.
- `next_action`: `wait`, `rebase`, `retry`, `release`, `stop`. See the [Agent guide](agent-guide.md#next_action).

### `retry <node> --key <k>`

Requeues a `failed` node, or a new review for a `verified` node whose review job failed to run. Author or human only. Returns the node status.

### `abandon <node> --reason <text> --key <k>`

Marks the node `abandoned`. Author or human only. Only for `submitted`, `evaluating`, `verified` or `failed` nodes; a merged node is reverted instead. Returns the node status.

## Humans

These commands read the human token from `FERVO_TOKEN`, or prompt for it on the terminal when it is unset. In a `fervo delegate` session, `FERVO_TOKEN` already holds a human token.

| Command | Effect |
|---|---|
| `review <node> --pass\|--fail --evidence <text> --key <k>` | Records a human verdict, then re-runs policy. Returns the verdict. |
| `merge <node> --reason <text> --key <k>` | Merges a `verified` node whose parent is `main`. |
| `veto <node> --reason <text> --key <k>` | Marks the node `abandoned`. Same states as `abandon`. |
| `revert <node> --reason <text> --key <k>` | Moves `main` back to the parent. Only for the current head. |
| `actor add <id> --kind human\|agent\|runner [--provider] [--model] [--harness] --key <k>` | Returns `{actor, token}`. The token is shown once; a replay returns `token: null`. |
| `actor list` | Lists all actors. |
| `actor disable <id> --key <k>` | Revokes the token. |
| `baseline --key <k>` | Queues a re-measurement of `main`. Returns the job. |

## Operator processes

| Command | Effect |
|---|---|
| `init --source <repo> --root <dir> --actor <id>` | Creates the managed root. Prints `{root, actor, token, main}`. |
| `serve --root <dir> [--host 127.0.0.1] [--port 8765]` | Runs the Git and JSON server. |
| `runner --remote <url> …` | Evaluates jobs. Flags in [Configuration](configuration.md#runner-flags). |
| `hook pre-receive` | Called by Git inside the managed repository. Not for direct use. |

## Errors

| Message | Cause | Fix |
|---|---|---|
| `required option '--key <key>' not specified` | a write without `--key` | add a fresh key |
| `idempotency key reused with a different request` | same key, different arguments or commit | use a new key, or repeat the exact original call |
| `uncommitted tracked changes: commit or stash before submit` | dirty working tree | commit |
| `lease is not active for actor` | expired, released, already submitted, or not yours | claim again |
| `claim cannot be renewed` / `claim cannot be released` | the claim is no longer active | nothing to do, or claim again |
| `claim review has not passed` | claim review enabled and not yet passed | `fervo status <lease> --wait`; if `review` is `failed`, release and claim again |
| `parent must be merged or verified` | the parent was rejected, failed or abandoned | pick a node from `context` |
| `supersedes must name your node and current main parent` | wrong `--parent` or someone else's node | use `context.main.node` |
| `only failed nodes or failed reviews can retry` | neither the node nor its review job failed | read `next_action` |
| `node is merged: revert it instead` / `node is already <state>` | `abandon` or `veto` on a merged, reverted, rejected or abandoned node | `revert` a merged node; otherwise nothing to do |
| `human token required` | a human-only command | ask a human |
| `human token required: run this in a terminal, or set FERVO_TOKEN for this one command` | a human command with no `FERVO_TOKEN` and no terminal | run it yourself, or use `fervo delegate` |
| `enroller token required` | `/enroll` called with a session or human token | only the clone's hook enrolls |
| `grant is invalid or expired` | `FERVO_GRANT` unknown, expired, or another human's | start again with `fervo delegate` |
| `human session: resume it through fervo delegate` | a delegated session resumed with plain `claude` | `fervo delegate -- --resume` |
| `agent session cannot gain human powers` | `delegate` resuming an agent session | start a new session with `fervo delegate` |
| `session actor is disabled` | a human disabled this session's actor | start a new session |
| `FERVO_TOKEN of <id> is in the environment Claude Code inherited…` | your human token is exported in the shell | unset it and restart `claude` |
| `HTTP 401` `invalid or disabled token` | bad or revoked token | get a new token |
| `--timeout must be an integer from 1 to 30` | bad `status --timeout` | use 1–30 |
| `push denied: <ref>` (from Git) | push outside your prefix | use `fervo submit` |
