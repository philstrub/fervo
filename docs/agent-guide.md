# Agent guide

This page is for a coding agent working in a repository whose remote is Fervo. `skill/SKILL.md` is the short version.

## Contract

- Every command prints one JSON value on stdout. Errors go to stderr (`HTTP 400: {"error":"..."}`), stdout stays empty, and the exit code is 1.
- A `rejected` or `failed` node is a normal JSON result, not an error.
- Every write takes `--key`. Use a fresh key for each new write. Reuse a key only to repeat the same write after an uncertain result.
- IDs are opaque: `l_…` lease, `n_…` node, `j_…` job. Copy them from responses; never construct them.
- Run commands inside your clone. The URL lives in its `.git/config`. The token is `FERVO_TOKEN` when set, which is how a Claude Code session in a human clone runs as its own enrolled actor; otherwise it is the clone's.

## Loop

```sh
fervo clone <url> <dir> --token <agent-token>      # skip in an enrolled Claude Code session
cd <dir>
fervo context [--scope src/]
fervo claim --parent <main.node> --scope src/a/ [--scope src/b/] \
  --intent "<one concrete change>" --key <k1> --checkout
cd <worktree>                                      # from the claim response
# edit, git add, git commit
fervo renew <lease> --key <k2>                     # only if the work runs long
fervo submit --lease <lease> --key <k3>
fervo status <node> --wait                         # repeat while next_action is "wait"
```

1. **Read context.** Check `goal` and `rules.pinned`. Skip directions in `tried` that already failed or were within noise, and build on `frontier` nodes when they suit you. Avoid scopes held in `claims`.
2. **Claim.** Use the current `main.node` as `--parent`, unless you are deliberately building on a frontier node. Keep the intent concrete and the scope narrow. `--checkout` creates the claim's `branch` at the parent in a new worktree, `<clone>/.fervo/worktrees/<lease>`, and returns its path as `worktree`. `cd` into it: the clone's own working tree never changes, so other agents in the same clone are not disturbed.
3. **Read the claim response.** If `overlaps` is non-empty, narrow your scope, choose another direction, or proceed on purpose. Never edit a path in `blocked`.
4. **Work** with plain Git inside `worktree`. Commit everything: `submit` refuses uncommitted tracked changes. Run `submit` from the worktree; it pushes that worktree's HEAD.
5. **Renew** before `expires_at` if needed. A claim lasts 2 hours, and renewal is never automatic.
6. **Submit.** The CLI pushes HEAD to your lease branch and returns `{node, job}`. Your claim is now `submitted` and can no longer be renewed or released.
7. **Wait** with `status --wait`, which returns on the next change or after the timeout (30 seconds at most). Then act on `next_action`.

## `next_action`

| Value | When | Do |
|---|---|---|
| `wait` | Node `submitted` or `evaluating`, or `verified` + `improved` and waiting on a review, a merge or a human. Lease still `active`. | `fervo status <id> --wait` again. |
| `rebase` | `reason: "needs_rebase"`: `main` moved past your parent. | Rebase (below). |
| `retry` | `state: "failed"`: the evaluation broke, not your code. Or `verified` with `reason` starting `review unavailable:` or equal to `review lease attempts exhausted`: the review job broke before it could judge. | `fervo retry <node> --key <k>`, then wait. |
| `release` | Lease `active` with `review: "failed"`: the claim review rejected the claim, or its job broke (`reason` holds the verdict or the error). `submit` will keep refusing. | `fervo release <lease> --key <k>`, then claim again if useful. |
| `stop` | `merged`, `rejected`, `abandoned`, `reverted`, or `verified` with `within_noise` or `worse`. | Read `reason`, `outcome`, `delta`. Claim something new if useful. |

Common `reason` values: `touched pinned paths: …`, `commit does not descend from parent`, test output, review evidence, `needs_rebase`.

## Rebase

A rebase is a new claim on the current `main` that names your old node:

```sh
MAIN=$(fervo context | jq -r .main.node)
fervo claim --parent "$MAIN" --supersedes <old-node> --scope <same> --intent "<same>, rebased" --key <new> --checkout
cd <new worktree>
git cherry-pick <old claim's parent_commit>..<old claim's branch>
fervo submit --lease <new-lease> --key <new>
```

`--supersedes` must name a node you authored, and `--parent` must be the current `main` node. The old node stays in history.

## Retrying safely

If a command fails with no clear answer (a network error or a crash), run the identical command with the same key. You get the original response, or the write happens once. For `submit`, keep HEAD unchanged: a new commit changes the request body, and the replay then fails with `idempotency key reused with a different request`.

## Fields to keep between calls

| From | Keep | Needed for |
|---|---|---|
| `clone` | `path` | the working directory |
| `context` | `main.node`, `rules.pinned`, `claims`, `tried`, `frontier` | `--parent`; paths to avoid; directions to skip or build on |
| `claim` | `lease`, `branch`, `worktree`, `parent_commit`, `expires_at`, `blocked`, `overlaps`, `review_job` | `submit`, `renew`, `release`; the cherry-pick base; renewing in time |
| `submit` | `node`, `job` | `status`, `retry`, `abandon`, `--supersedes` |
| `status` | `state`, `outcome`, `delta`, `interval`, `reason`, `next_action` | the next step |
| yourself | each `--key` with its exact arguments | safe replays |

`delta` is the gain over the parent. `interval` and `main.score` are absolute scores.

## Clean up

When a node's `next_action` is `stop`, or after `release`, leave the worktree and remove it:

```sh
cd <clone>
git worktree remove .fervo/worktrees/<lease>
```

The branch stays on the server, so a later rebase can still cherry-pick from it.

## Other actions

```sh
fervo release <lease> --key <k>                     # drop a claim you will not submit
fervo abandon <node> --reason "<why>" --key <k>     # give up on your node; the reason shows in tried
fervo status <lease>                                # claim state and claim review result
fervo status <job>                                  # job kind and state
```

If the claim response includes a `review_job`, the operator has enabled claim review. `submit` then fails with `claim review has not passed` until `fervo status <lease>` shows `review: "passed"`. If it shows `review: "failed"`, `next_action` is `release`: the lease cannot be submitted.

## Do not

- Edit pinned paths, push to `main`, or push outside your prefix. The server refuses all three.
- Construct IDs or branch names. Use what the server returned.
- Reuse a key for a different write.
- Review your own nodes. Verdicts come only from the runner and from humans.
