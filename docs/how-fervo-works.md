# How Fervo works

## Components

```text
 agents, humans                    operator machine
 ┌──────────────┐  Git + JSON  ┌──────────────────────────┐  jobs   ┌──────────────┐
 │ fervo CLI    │─────────────►│ fervo serve              │◄────────│ fervo runner │
 │ plain git    │   over HTTP  │  <root>/repo.git (bare)  │ verdicts│ tests,metrics│
 └──────────────┘              │  <root>/.fervo/fervo.db  │────────►│ judge, review│
                               └──────────────────────────┘         └──────────────┘
```

- **Server** (`fervo serve`): the only writer. It owns the bare repository and the SQLite database. It authenticates every request, serves Git over smart HTTP at `/git/repo.git`, and answers the JSON API. It never calls a model and never runs submitted code.
- **Runner** (`fervo runner`): an API client with a runner token. It leases jobs, checks out commits in temporary worktrees, runs the tests and metrics, calls the models with the operator's keys, and posts verdicts back.
- **CLI** (`fervo`): agents and humans use it for everything except editing, which is plain Git. It reads the server URL from the clone's `.git/config`, and the token from `FERVO_TOKEN` or, when that is unset, from `.git/config`.

## Objects

| Object | ID | What it is |
|---|---|---|
| Actor | its name | A token holder: `human`, `agent`, `runner` or `enroller`. Agents carry a `provider`, `model` and `harness`. Enrolled actors also carry their `owner` and harness `session`. |
| Claim | `l_…` | A declaration made before work starts: parent node, scope, intent. Called a *lease* in commands. |
| Node | `n_…` | A submitted commit, with its parent node, changed paths, state, outcome and score. `n_0` is the initial `main`. |
| Job | `j_…` | Runner work: `baseline`, `eval`, `review`, `postmerge`, `claim_review`. |
| Verdict | `v_…` | One check's result on a node or claim: producer, provider, pass/fail or samples, evidence, and a hash of the command or prompt. |
| Event | sequence number | An append-only log of every change. |

`context`, the frontier, overlaps and tried directions are not stored; each request recomputes them from these tables.

## Identities

Two kinds of clone exist:

- **Agent clone.** `fervo clone` with an agent token stores that token in `.git/config`. The clone is that agent's. Use it for headless agents and for harnesses other than Claude Code.
- **Human clone.** `fervo clone` with a human token (prompted when absent) never stores it. The server creates an `enroller` actor owned by that human, and the clone stores the enroller's token. An enroller can read and fetch, and it can enroll sessions. It cannot push, claim, review or manage actors. The clone also gets `.claude/settings.local.json`, excluded from Git, with a SessionStart hook that runs `fervo enroll`.

Each Claude Code session started in a human clone calls `POST /enroll` with its session id and becomes the actor `<owner>-<first 12 characters of the session id>`. The hook writes `export FERVO_TOKEN=<token>` to `$CLAUDE_ENV_FILE`, so every shell command in that session runs as that actor. The actor's provider and harness come from the enroller, fixed at clone time, so a session cannot choose its own judge. Enrolling a known session again (resume, compaction) rotates its token. Each session therefore has its own branch prefix, its own `mine`, and its own idempotency keys.

A human reaches human-only commands in two ways: by typing the token at the prompt the CLI shows for them, or by `fervo delegate`. `delegate` asks for the token, creates a 12-hour grant, and starts `claude` with that grant in its environment. That session then enrolls as a `human` actor owned by the human. A session's kind never changes: an agent session cannot become human, and a human session resumed without `delegate` is refused.

## A claim's life

```text
active ──► submitted
   │
   ├────► released   (fervo release)
   └────► expired    (2 h after the claim or the last renew)
```

A claim records the parent, scope and intent. The server answers with the lease, the pinned paths (`blocked`), and the overlaps: active claims and recent nodes whose scope shares a path with the new one. Overlaps are warnings. A claim never locks files.

## A node's life

```text
submit ─► submitted ─► evaluating ─► verified ─► merged ─► reverted
              │             │            │
              ▼             ▼            ▼
          rejected       failed      rejected (review or human failed)
       (pinned path,  (eval crashed)  abandoned (abandon, veto)
        not a descendant,  │
        tests failed)      └─ fervo retry ─► submitted
```

At submit, the server checks that the commit is the pushed lease branch and descends from the claim's parent commit. It then lists the changed paths and rejects the node at once if any of them is pinned. Otherwise it queues an `eval` job.

## Evaluation

The runner reads the policy from `main`, never from the node, so a node cannot change its own tests or metrics.

1. **Tests.** Runs `tests.cmd` in the node's worktree. A failure rejects the node with the test output as `reason`.
2. **Paired metrics.** For each of `eval.samples` rounds, runs every metric on the parent and then on the node. Each value is normalized against the baseline mean: `value/baseline` for `max`, `baseline/value` for `min`. The round's gain is `Σ weight · (node − parent)`.
3. **Judge** (if `[judge]` is set). A model from a provider other than the author's compares the node and the parent, once in each order. It sees the goal, intent, scope and diff. Its preference adds `judge.weight · (2·p − 1)` to each round's gain.
4. **Score.** From the per-round gains, `interval = mean ± 1.96 · √(variance/n + noise²)`, where `noise` comes from the baseline's spread. The outcome is `improved` if the interval lies above 0, `worse` if it lies below 0, and `within_noise` otherwise. A node's score is its parent's score plus the gain. `n_0` scores 1.

The judge is Anthropic unless the author's provider is `anthropic`, in which case it is OpenAI.

## Policy and merge

Each changed path contributes requirements: from the `[[merge.rules]]` entries that match it, or from `merge.main.require` if none match. The node needs the union of all of them.

| Requirement | Satisfied when | Otherwise |
|---|---|---|
| `tests` | the tests verdict passed | rejected |
| `frontier_gain` | outcome is `improved` | stays `verified`; no automatic merge |
| `review` | a runner model review passed (queued on demand) | rejected if it fails |
| `human` | a human ran `fervo review --pass` | rejected on `fervo review --fail`; stays `verified` until a verdict |

When every requirement holds, the server moves `main` with a compare-and-swap from the parent commit to the node commit. If `main` is no longer at the parent, the node gets `reason: needs_rebase` and its author re-claims with `--supersedes`. After a merge, a `postmerge` job re-runs the tests and metrics on `main`. If those tests fail while the node is still the head of `main`, the node is reverted. If `main` has already moved past it, the node stays `merged` with a `reason` asking for a manual revert, since reverting would discard the later nodes.

## Context

`fervo context` returns what an agent needs before choosing work:

- `goal`, `metrics`, and `rules` (the pinned paths and the requirements per path pattern);
- `main`: the current head node, its commit and its score;
- `frontier`: up to 10 verified, improved, unmerged nodes, best score first, leaving out any node that already has an improved child;
- `claims`: up to 20 active claims;
- `tried`: up to 20 nodes whose latest outcome is newer than `context.tried_ttl`, so old failures stop discouraging new attempts;
- `mine`: your active leases and recent events on your work;
- `frontier_version`: a counter that changes whenever claims, nodes or merges change.

`--scope` filters `claims` and `tried` to the entries that overlap the given paths.

## Git layout

```text
refs/heads/main                    moved only by the server
refs/heads/agents/<actor>/<lease>  pushed by that agent (fervo submit)
refs/heads/humans/<actor>/<lease>  pushed by that human
refs/fervo/nodes/<node>            created at submit; never moves
```

On the agent's machine, every lease checked out with `claim --checkout` gets its own Git worktree, `<clone>/.fervo/worktrees/<lease>`. The clone's working tree stays where it was, so several agents can share one clone without moving each other's HEAD or index.

A `pre-receive` hook rejects any push outside the pusher's own prefix. Runner and enroller tokens cannot push at all, so in a human clone only `fervo submit`, which pushes with the session's `FERVO_TOKEN`, can push.

## Writes and retries

Every write carries an `Idempotency-Key`, which the CLI takes from `--key`. The server stores `(actor, key) → request hash, response` in the same transaction as the write. The same key with the same body returns the stored response. The same key with a different body is an error. A crashed agent can therefore repeat its last command without creating a duplicate.

Runner jobs use leases. The runner long-polls for up to 30 seconds and holds each job for 90 seconds, renewing it every 30 seconds while it works. A job whose lease lapses is offered again. After three attempts it fails: an `eval` job then marks its node `failed`, and a `review` or `postmerge` job records its error in the node's `reason`.

## Not in this MVP

- `fervo import`, `fervo skill install`, the web UI, and AI summaries in `context`.
- Loadable plugins. `src/plugins.ts` defines the plugin interfaces, but only the four built-in policy rules exist.
- Changing the policy after `init`: `fervo.toml` is pinned and `main` moves only through nodes. Re-initialize to change it.
- One review per provider. A single runner review uses `--review-provider`.
- `--scope` is not compared with the changed paths; only pinned paths are enforced.
