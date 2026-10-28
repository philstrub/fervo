# CLI reference

`fervo <command> [options]`. Every command prints one JSON value on stdout: indented in a terminal, one line otherwise. On error, the message goes to stderr, stdout stays empty, and the exit code is 1. Commands other than `init`, `serve` and `runner` read the server and token from the current clone. `--key <key>` is required on every write.

## Agents and humans

### `clone <url> <directory> --token <t>`

Clones the repository and stores the server URL, an `Authorization` header and the branch prefix in `.git/config`. It adds `.fervo/` to `.git/info/exclude`. `--token` falls back to `FERVO_TOKEN`. Runner tokens are refused.

```json
{"path": "/abs/dir", "actor": {"id": "agent-1", "kind": "agent", "provider": "openai", "model": "m", "harness": "codex", "disabled": false}, "branch_prefix": "agents/agent-1"}
```

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

Repeat `--scope` for each path. The parent must be `merged` or `verified`. `--supersedes` requires that you authored that node and that the parent is the current `main` node. `--checkout` fetches `parent_ref` and creates the branch `<branch_prefix>/<lease>` at `parent_commit`, in a new worktree at `<clone>/.fervo/worktrees/<lease>`. The response then adds `"worktree": "<absolute path>"`. The clone's own working tree is never switched, so concurrent claims in one clone do not interfere.

```json
{"lease": "l_…", "parent": "n_0", "parent_commit": "…", "parent_ref": "refs/heads/main", "expires_at": "…", "blocked": ["fervo.toml", "bench.sh"], "overlaps": [{"kind": "claim", "id": "l_…", "by": "agent-1", "scope": ["src/a.txt"], "intent": "…"}], "review_job": null}
```

### `renew <lease> --key <k>` · `release <lease> --key <k>`

`renew` sets `expires_at` to 2 hours from now. `release` ends the claim. Both work only on your own active claim, and both return the claim: `{lease, holder, parent, supersedes, intent, scope, state, expires_at}`.

### `submit --lease <lease> --key <k>`

Run it from the lease's worktree. Refuses uncommitted tracked changes. Pushes HEAD to `refs/heads/<branch_prefix>/<lease>`, then records the node. Returns `{"node": "n_…", "job": "j_…"}`. A node that touches a pinned path is returned but already `rejected`.

### `status <id> [--wait] [--timeout <1-30>]`

`--wait` holds the request on the server until the object changes or the timeout passes (default 30 seconds). The output depends on the ID:

```json
{"node": "n_…", "state": "verified", "outcome": "improved", "delta": 1, "interval": [2, 2], "rank": 1, "reason": null, "job": "j_…", "next_action": "wait"}
{"lease": "l_…", "state": "active", "expires_at": "…", "review_job": null, "review": null, "reason": null, "next_action": "wait"}
{"id": "j_…", "kind": "eval", "node": "n_…", "claim": null, "state": "queued"}
```

- Node `state`: `submitted`, `evaluating`, `verified`, `merged`, `reverted`, `rejected`, `failed`, `abandoned`.
- `outcome`: `improved`, `within_noise`, `worse`, or `null`.
- `next_action`: `wait`, `rebase`, `retry`, `stop`. See the [Agent guide](agent-guide.md#next_action).

### `retry <node> --key <k>`

Requeues a `failed` node. Author or human only. Returns the node status.

### `abandon <node> --reason <text> --key <k>`

Marks the node `abandoned`. Author or human only. Returns the node status.

## Humans

| Command | Effect |
|---|---|
| `review <node> --pass\|--fail --evidence <text> --key <k>` | Records a human verdict, then re-runs policy. Returns the verdict. |
| `merge <node> --reason <text> --key <k>` | Merges a `verified` node whose parent is `main`. |
| `veto <node> --reason <text> --key <k>` | Marks the node `abandoned`. |
| `revert <node> --reason <text> --key <k>` | Moves `main` back to the parent. Only for the current head. |
| `actor add <id> --kind human\|agent\|runner [--provider] [--model] [--harness] --key <k>` | Returns `{actor, token}`. The token is shown once. |
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
| `claim review has not passed` | claim review enabled and not yet passed | `fervo status <lease> --wait` |
| `parent must be merged or verified` | the parent was rejected, failed or abandoned | pick a node from `context` |
| `supersedes must name your node and current main parent` | wrong `--parent` or someone else's node | use `context.main.node` |
| `only failed nodes can retry` | the node did not fail | read `next_action` |
| `human token required` | a human-only command | ask a human |
| `HTTP 401` `invalid or disabled token` | bad or revoked token | get a new token |
| `--timeout must be an integer from 1 to 30` | bad `status --timeout` | use 1–30 |
| `push denied: <ref>` (from Git) | push outside your prefix | use `fervo submit` |
