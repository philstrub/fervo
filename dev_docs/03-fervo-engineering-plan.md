# Fervo: engineering plan

*For Filippo and Roshan. Written 2026-10-21 and updated 2026-10-27. This plan separates the package and CLI work from the later study and reporting work.*

This plan turns the proposal (`02-fervo-report.md`, with the long form in `PRD.md`) into something we can build in about six weeks. The rule throughout is the one in the pitch: a small core with good defaults, and everything else as a plugin. Whenever a feature can live outside the core, it does. Whenever there is a simpler way to get the demo working, we take it and write down what we gave up.

**Two tracks.** The product track builds the TypeScript package: the repo manager, server, runner, and CLI. Its first deliverable for Assignment 6 is a working end-to-end CLI loop on a small test repo. The study and reporting track creates or selects the target repo, sets up agents that use the CLI, runs tests and eventually the comparison, and writes up the evidence. The comparative study is not a dependency of the first MVP. It may be run for the November 19 demo or later as a benchmark, depending on what the next weeks show. For Assignment 6, Filippo leads the package and CLI track; Roshan leads tests and the study/agent setup track. These are workstream leads, not exclusive ownership: both work across the project and review each other's changes.

## 1. What we are building, and what we are not

The first MVP has to support one complete loop through the repo-manager CLI: initialize a repo, serve it, create actors, let an agent read context, declare a claim, push and submit a commit, have the runner evaluate it, and merge or reject it by policy with a human override. A scripted agent on a small test repo is enough to verify this loop. Four live agents, the study repo and a comparative baseline belong to the later study track.

In scope for the MVP:

- `fervo init` and `fervo serve`: a bare git repo plus SQLite, served over HTTP, with token auth and per-actor branch permissions.
- The core objects (actors, claims, nodes, verdicts, jobs) and the derived queries (frontier, overlaps, tried directions, context).
- `fervo runner`: runs tests, metrics, claim review, and the initial merge review on the operator's machine with the operator's keys.
- Scoring with a baseline, noise-aware promotion, and pinned paths.
- The policy engine with the initial merge review, rebasing rules and human override. Richer review pipelines and the second merge mode can follow after the loop works.
- The agent CLI with JSON output, and an initial SKILL.md for agents using it.
- The plugin interfaces, with the built-in checks written as plugins.
- `fervo import`, GitHub mirroring, the UI tab, additional harness integrations, and the comparative study are later deliverables.

Not in the first MVP, though the design leaves room for them: hosting of any kind, launching or orchestrating agents, an MCP server (the CLI comes first), several repos per server, issue import and drafting `fervo.toml` from CODEOWNERS (stretch goals), sandboxing beyond running the runner in a container, semantic matching of intents, and rescoring old nodes after the judge changes.

## 2. Architecture

There are three processes, and only one of them ever holds model keys.

```
   agent clones (one per agent)                  operator's machine
  ┌─────────────────────────┐                  ┌──────────────────────────┐
  │ Claude Code / Codex / pi│                  │ fervo runner             │
  │   git  +  fervo CLI     │                  │  - leases jobs           │
  └───────────┬─────────────┘                  │  - runs tests / metrics  │
              │ HTTPS: git smart HTTP          │  - calls LLM providers   │
              │        + JSON API              │    with operator's keys  │
              ▼                                └────────────┬─────────────┘
  ┌───────────────────────────────────────────┐             │ JSON API
  │ fervo serve  (any machine the team runs)  │◄────────────┘
  │  - bare git repo      - SQLite (WAL)      │
  │  - pre-receive hook   - policy engine     │──► optional mirror push to GitHub
  │  - derived queries    - UI tab (/ui)      │
  └───────────────────────────────────────────┘
```

`fervo serve` is the only thing that writes state. It has no model client and no API keys. The runner is a client like any agent, with its own token and the kind `runner`. It never pushes code, and it is the only actor besides humans that can write verdicts. For the demo, the server and the runner can run on the same laptop, but they stay separate processes, so the "no intelligence on the server" claim holds in practice and not only on paper.

## 3. Technology choices

We will write the package, CLI, server, runner, and tests in TypeScript on Node.js 24 LTS and publish the package through npm. The existing Python CLI branch is a prototype to migrate, not a second supported implementation. The study target may still be a Python library; its language does not determine Fervo's implementation language. [Node.js release schedule](https://nodejs.org/en/about/previous-releases).

- CLI: Commander for argument parsing and a TypeScript entry point. Every command prints JSON, indented on a terminal and compact when piped. [Commander documentation](https://github.com/tj/commander.js/blob/master/Readme.md).
- Server: Node.js HTTP service, with handlers sharing the same schemas as the CLI and runner.
- Shared models: Zod schemas validate API requests, responses, and configuration at runtime and generate JSON Schema for agent and model contracts. [Zod JSON Schema documentation](https://zod.dev/json-schema).
- Storage: SQLite through `better-sqlite3` in WAL mode, with short synchronous transactions in the server process. Never hold a transaction open across an `await`; the server uses compare-and-swap when moving `main`. Node 24's built-in SQLite API is still a release candidate, so use the supported driver for this MVP. [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3); [Node 24 SQLite status](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
- Git: the `git` binary through child processes, without a second Git implementation.
- Git over HTTP: `git http-backend` behind the Node.js server. The server checks the token and sets `REMOTE_USER`.
- LLM calls: provider adapters in the runner, with operator-owned keys. The initial reviewer can use Claude Opus; study judges must still follow the configured independence rule.
- Tests: Node's stable built-in test runner, with real Git and HTTP integration fixtures for the end-to-end loop. [Node test runner](https://nodejs.org/api/test.html).
- UI: server-rendered HTML, if we build the later UI tab.

These libraries are deliberately few. Package versions are pinned in the lockfile; the API contract and CLI behavior are the durable boundaries.

### Agent-first operating contract

Fervo's primary user is an agent swarm. Humans configure goals, budgets and escalation policy, inspect outcomes, and intervene when needed. The ordinary loop must work without a browser, a pull request, an interactive prompt, or a human waiting on each merge. This is a product requirement, not a claim that every agent workflow has a universal best practice.

- **One small, literal command surface.** Use the same nouns and IDs in the CLI and API: actor, claim/lease, node, verdict, job. Commands do one action and return the resulting object or a specific next action (`wait`, `rebase`, `retry`, `stop`). Keep Git operations recognizable to coding agents. Anthropic's tool-design work recommends clear names, meaningful responses and token-efficient outputs; OpenAI's Codex guidance finds tool calls work best when they resemble the underlying command. [Anthropic: writing tools for agents](https://www.anthropic.com/research/writing-tools-for-agents); [OpenAI: Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide).
- **Deterministic, compact JSON.** One schema per result; JSON on stdout, diagnostics on stderr, stable exit codes. An unsuccessful *policy decision* is a valid response with `state`, `reason`, and `next_action`; an invalid request or broken transport is an error. Bound lists, diffs and logs, and return IDs or cursors for details instead of dumping entire histories. Structured responses should be validated at the boundary, including model-produced verdicts. [Anthropic: writing tools for agents](https://www.anthropic.com/research/writing-tools-for-agents); [OpenAI: structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
- **Few round trips and safe retries.** `claim` returns the parent ref, blocked paths, overlap warnings and expiry in one response; `submit` returns node and job IDs; `status --wait` blocks for a bounded change event. Every write requires an idempotency key. Agents can resume from a saved ID after a crash instead of replaying a workflow blindly. We measure command latency and calls per completed node in the toy agent run.
- **Fresh target and fast integration.** Git remains the storage and transport layer for this repo size; do not build a new source-control system for the MVP. Keep the target-head check and ref update atomic, require rebase when it moved, and run checks on the rebased commit. Cache fetched objects in the runner and materialize worktrees only for checks that need files. Git protocol v2 can reduce unnecessary ref advertisement; adopt its supported features before inventing a protocol. Anthropic reports that agent-scale bottlenecks led it to expose server-side source-control queries and avoid a global merge queue, but also says its bespoke replacement is unsuitable for most repos. [Anthropic: redesigning source control](https://www.anthropic.com/research/redesigning-source-control); [Git protocol v2](https://git-scm.com/docs/protocol-v2).
- **Review that spends attention where it helps.** Run deterministic checks first, then model reviews; rank findings by severity and require file and line evidence. Keep review stages and spending caps in runner configuration. Human escalation depends on configured risk, not on every node by default. The full multi-stage process in the course review notes is a later profile, not a mandatory slow path for the first MVP. [Anthropic: redesigning source control](https://www.anthropic.com/research/redesigning-source-control); [Anthropic: demystifying agent evals](https://www.anthropic.com/research/demystifying-evals-for-ai-agents).
- **Test the interface with agents.** Run scripted and live tasks against the CLI and record success rate, invalid commands, tool calls, tokens spent reading context, median and tail command latency, review queue time, rebase retries, and time to a merged node. Change commands and responses based on observed failures. Anthropic recommends evaluating tools on realistic multi-call tasks and tracking runtime, calls, tokens and errors. [Anthropic: writing tools for agents](https://www.anthropic.com/research/writing-tools-for-agents).

## 4. Data model

Every table lives in `.fervo/fervo.db` next to the bare repo. Ids are short, typed strings (`n_57`, `l_9`, `j_31`), so they read well in agent transcripts.

```sql
actors(
  id TEXT PRIMARY KEY,            -- "claude-1", "codex-1", "runner", "filippo"
  kind TEXT,                      -- human | agent | runner | system
  provider TEXT, model TEXT, harness TEXT,
  token_hash TEXT,                -- sha256 of the token; the token is shown once
  disabled INTEGER DEFAULT 0, created_at TEXT)

claims(
  id TEXT PRIMARY KEY,            -- lease id, "l_9"
  holder TEXT REFERENCES actors,
  parent_node TEXT REFERENCES nodes,
  supersedes TEXT REFERENCES nodes, -- optional old node when rebasing onto a moved target
  intent TEXT,
  scope TEXT,                     -- JSON list of path globs
  state TEXT,                     -- active | submitted | expired | released
  overlaps_at_grant TEXT,         -- JSON snapshot of the warnings we returned
  proceed_reason TEXT,            -- why the agent went ahead despite overlaps
  expires_at TEXT, created_at TEXT)

nodes(
  id TEXT PRIMARY KEY,            -- "n_57"; "n_0" is the baseline at init
  commit_sha TEXT, parent_node TEXT REFERENCES nodes,
  claim TEXT REFERENCES claims, author TEXT REFERENCES actors,
  intent TEXT, scope TEXT, changed_paths TEXT,   -- JSON
  state TEXT,                     -- see section 6
  outcome TEXT,                   -- improved | within_noise | worse | NULL
  score_mean REAL, score_lo REAL, score_hi REAL,
  reason TEXT,                    -- for rejected / failed / reverted
  supersedes TEXT,                -- copied from the new claim on rebased resubmission
  merged_as TEXT,                 -- commit on main, once merged
  created_at TEXT)

verdicts(
  id TEXT PRIMARY KEY,
  node TEXT REFERENCES nodes,          -- exactly one of node or claim is set
  claim TEXT REFERENCES claims,
  reviewer TEXT REFERENCES actors,     -- the runner or a human, never the author
  producer TEXT,                       -- "tests", "metric:throughput", "judge", "review", "human"
  provider TEXT,                       -- for model-made verdicts
  passed INTEGER,                      -- 1 / 0 / NULL for pure measurements
  samples TEXT,                        -- JSON list of numbers, for metrics and judge
  evidence TEXT,                       -- short text; the full log goes to .fervo/logs/
  recipe_hash TEXT,                    -- hash of the prompt template + model, or of the command
  created_at TEXT)

jobs(
  id TEXT PRIMARY KEY,            -- "j_31"
  kind TEXT,                      -- claim_review | eval | review | summary | postmerge | baseline
  node TEXT, claim TEXT, payload TEXT, -- JSON
  state TEXT,                     -- queued | running | done | failed
  runner TEXT, lease_until TEXT, attempts INTEGER DEFAULT 0,
  result TEXT, created_at TEXT)

idempotency(actor TEXT, key TEXT, request_hash TEXT, response TEXT,
            PRIMARY KEY (actor, key))

events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, actor TEXT,
       type TEXT, subject TEXT, data TEXT)      -- append-only

baselines(metric TEXT, commit_sha TEXT, samples TEXT, mean REAL, sd REAL, created_at TEXT)
summaries(frontier_version INTEGER PRIMARY KEY, text TEXT, job TEXT)
```

Three choices are worth explaining.

The `events` table is an append-only log, and every state change writes a row to it in the same transaction. It gives us an audit trail, a cursor for "what changed since I last looked", the frontier version (the `seq` of the last event that changed a node or a claim), and every number the study needs, with no extra logging.

The frontier, overlaps and rank are not stored. They are SQL queries over `nodes` and `claims` (section 7), so they can never go stale.

A claim and a node are separate objects. A claim exists from the moment an agent declares what it will do, and a node from the moment it submits a commit. The proposal folded `claimed` into the node's states. Splitting them keeps both state machines short.

## 5. Git layout and permissions

The bare repo lives at `<root>/repo.git`, and the server serves it at `https://<host>/git/repo.git`.

```
refs/heads/main                       moved only by the server (policy engine or a human's merge)
refs/heads/agents/<actor>/<name>      each agent pushes only under its own prefix
refs/heads/humans/<actor>/<name>      the same, for humans
refs/fervo/nodes/n_57                 created by the server at submit: an immutable pointer, so nothing gets lost
refs/heads/import/pr-<N>              created by fervo import
```

The server installs a `pre-receive` hook that runs `fervo hook pre-receive`. It reads `REMOTE_USER` (the actor id set after the token check) and rejects any ref update outside `refs/heads/agents/<actor>/` or `refs/heads/humans/<actor>/`. Runner tokens cannot push at all. The server's own writes (moving `main`, creating node refs, reverts) run `git` directly on the bare repo, so they never pass through the hook. Moving `main` always uses a compare-and-swap, `git update-ref refs/heads/main <new> <old>`, under the server's write lock.

Auth uses one random 32-byte token per actor, created by `fervo actor add --kind agent --provider anthropic --model claude-sonnet-5-5 --harness claude-code`. The command prints the token once, and the server stores only its hash. `fervo clone <url>` writes the remote, actor prefix, and an HTTP authorization header into the clone's `.git/config` (never the working tree). The CLI reads that same configuration. Plain `git fetch` and `git push` then work without a credential-helper process.

If `git http-backend` behind the Node.js server costs more than a day, decide whether SSH with a forced command or a local-only `file://` remote is acceptable for the first demo. This changes the authentication boundary and must be recorded as an explicit demo constraint.

## 6. The life of a claim and a node

Claim states: `active → submitted | expired | released`. A claim lasts two hours by default. Calls from its holder that identify the lease renew it; a working agent can also renew explicitly during long edits. The response always states `expires_at`, so the agent can act before expiration.

Node states:

```
submitted ──► evaluating ──► verified ──► merged ──► reverted
     │             │             │
     ▼             ▼             ▼
  rejected       failed       abandoned
```

`rejected` means the node broke a rule before or during evaluation: it touched a pinned path, its tests failed, or its commit does not descend from its parent. `failed` means the evaluation itself broke (a crash, a timeout, or the judge unavailable), and the log is kept. `verified` nodes carry an outcome: `improved`, `within_noise` or `worse`. `abandoned` is a human veto, or the agent giving up with `fervo abandon`. A node whose parent branch has moved must be rebased and resubmitted before merging.

This is the full sequence for the example in the report:

1. `fervo context` runs read-only queries (section 10).
2. `fervo claim --parent n_42 --scope src/lexer/ --intent "..." --key k0` makes the server check the parent, compute overlaps with active claims and recent, unexpired tried labels, insert the claim, and return the lease and warnings. If configured, it also enqueues a runner-owned claim review of intent and scope; `fervo status l_9` reports its result. With `--checkout`, the CLI creates `agents/<actor>/l_9` at the parent's commit.
3. The agent works and commits with plain git.
4. `fervo submit --lease l_9 --key k1` makes the CLI push `HEAD` to `refs/heads/agents/<actor>/l_9` and then call `POST /submit {lease, commit}` with the key in the `Idempotency-Key` header. The server checks that the commit descends from the claim's parent commit, computes `changed_paths`, rejects the node at once if any changed path is pinned, creates the node and `refs/fervo/nodes/n_57`, marks the claim `submitted`, enqueues an `eval` job, and returns `{"job":"j_31","node":"n_57"}`.
5. The runner leases `j_31` and runs the evaluation (section 9).
6. The server stores the verdicts, computes the score and the outcome, and runs the policy engine (section 8), which may enqueue `review` jobs or merge.
7. `fervo status j_31` (or `fervo status n_57`; a lease ID works for claim review) returns the current state at any point. `--wait` uses a bounded server-side wait for a state change and returns the next state; agents need no busy polling loop.

Idempotency: every mutating request carries a key that the agent chooses. The server stores `(actor, key) → response` in the same transaction as the write. A repeated request with the same key and the same body gets the stored response back. The same key with a different body is an error. That is what makes "retry after a crash" safe.

Rebasing uses a **new claim and lease**. When a node gets `needs_rebase`, its author calls `fervo claim --parent <current-target-node> --supersedes <old-node> ... --key <new-key>`, rebases the old work onto that parent, and submits under the new lease. The old claim remains submitted and the old node remains in history; the new claim and node link to it through `supersedes`. The server validates that the new claim belongs to the old node's author and that its parent is the current target head. This makes retries and lineage explicit.

## 7. Scoring and the frontier

The operator defines what "better" means in `fervo.toml`. Fervo makes measuring it cheap and hard to fake.

```toml
[goal]
text = "Streaming parser API; keep the public interface stable"

[tests]
cmd = "pytest -q"
timeout = "10m"

[[metrics]]
name = "throughput"
cmd = "python bench.py"      # must print one number on its last line of output
direction = "max"
weight = 0.6

[judge]
template = "frontier-v1"        # runner-owned template
model = "configured-per-author-provider"
weight = 0.4

[eval]
samples = 3                  # default metric runs and judge samples per node
baseline_samples = 5         # default runs on the baseline

[context]
tried_ttl = "7d"            # labels expire from context; history is retained

[pinned]
paths = ["bench/**", "bench.py", "fervo.toml"]
```

The baseline measurement: `fervo init` (or `fervo baseline`) enqueues a `baseline` job. The runner runs each metric `baseline_samples` times on the current `main` and stores the mean μ and standard deviation σ. That baseline is node `n_0`. This measurement baseline is separate from the still-undecided comparison arm in the study.

Normalising: one metric run m becomes r = m / μ when higher is better, and r = μ / m when lower is better. The baseline therefore scores 1.0 on every metric, and 1.18 means 18% better. Metric values must be positive. A metric that can be zero or negative is a plugin's job.

The judge: each of the three sample pairs compares the node with its parent once in each presentation order, as specified in the report. It runs in the runner, under a model from a provider other than the author's. Claude Opus is an option for runner reviews; claims written by Claude Code agents need a non-Anthropic judge.

A node's gain: for each paired metric run, normalize the node and parent measurements against the same baseline, then subtract parent from node. Average the two order-balanced judge preferences for that pair and center the result at zero: preferring the node adds evidence for gain, preferring the parent subtracts it. The runner combines the weighted metric differences and judge preference into a paired gain sample; the status API exposes its mean and 95% interval.

```
gain_i = Σ_metrics w · (r_node,i − r_parent,i) + w_judge · (2 · mean(preference_i,forward, preference_i,reversed) − 1)
```

We report the gain samples' mean and a 95% interval, using the paired sample variance and the baseline's measured noise floor. The exact interval calculation is versioned with the scoring recipe and tested against known paired examples. The baseline normalizes metrics; it is not used as a substitute for rerunning the parent in each evaluation.

The outcome compared with the parent uses the interval on the paired gain from parent and node runs in the same evaluation job, rather than comparing two independently stored score intervals:

- `improved` if the paired gain's lower bound is above zero;
- `worse` if the paired gain's upper bound is below zero;
- `within_noise` otherwise.

The frontier is a query: verified, improved nodes that are not merged or abandoned, and that have no improved, verified descendant (once a child beats a node, the child is the place to build). The query ranks them by score. `main`'s head is always included as the root, scored by its post-merge job (section 8).

Tried directions are also a query: recent nodes with their intent, scope, outcome and reason, newest first, filterable by scope. `fervo.toml` sets `tried_ttl = "7d"` by default; a node stops appearing in `context.tried` seven days after its last outcome change. The node, verdicts and events remain in the historical record. An operator can tune the TTL for the task. Fervo does not judge whether a new intent "is the same" as an old one.

A known limitation: changing the judge template, the judge model or a metric changes what a score means. In the MVP, any such change starts a new epoch. We re-run the baseline, and scores before and after are not compared. Rescoring old nodes is a later plugin.

## 8. Policy engine and merging

The policy engine runs inside the server after every event that touches a node: a new verdict, a finished job, a human action or a timeout. It is a pure function from the node, its verdicts and `fervo.toml` to one of `satisfied`, `pending(jobs to enqueue)` or `failed(reason)`.

```toml
[merge.main]
mode = "verify_then_merge"       # "merge_then_verify" is a later option
require = ["tests", "frontier_gain", "review"]
human_override = true

[review]
profile = "basic"              # runner-owned; richer profiles can add stages
model = "claude-opus"         # example reviewer model, resolved by runner config

[[merge.rules]]
paths = ["docs/**", "**/*.md"]
require = ["tests"]

[[merge.rules]]
paths = ["src/auth/**"]
require = ["human"]
```

Path rules: for each changed file, we collect the `require` lists of every rule whose globs match it. If none matches, the file gets the default `[merge.main].require`. The node's requirements are the union over all its files. A docs-only change then needs only tests, a change to `src/auth/` needs a human, and a change touching both needs both. The rule is easy to explain, and a change can never slip past a stricter rule by being mixed with a lenient one.

The built-in requirements are policy-rule plugins:

- `tests`: a passing `tests` verdict.
- `frontier_gain`: outcome `improved`.
- `review`: a passing runner-owned pre-merge review verdict under the configured profile. The basic profile calls one reviewer model; Claude Opus is a possible choice. On timeout, policy holds the verified node with a visible reason.
- `contributor_review`: an optional richer rule that can require reviews from multiple providers, counted once per provider. `providers = "active"` can require the providers of agents with a recent claim or node; it can also be an explicit list. On timeout, `hold` keeps the node verified and unmerged, while `fail` rejects it.
- `human`: a passing verdict from a human actor.

The runner writes claim-review and pre-merge-review verdicts. A human can also write an override verdict. Working agents do not write review verdicts. The runner records the model and provider behind each model-made review, and policy can group those verdicts by provider, so three Claude reviews make one Claude vote. Basic review may use Opus even for Claude-authored code; a stricter profile can require a different provider. The pairwise **judge** always uses a different provider from the author.

Review stages are configured in the runner, from the basic MVP profile to a larger workflow like the one described in `research/notes/code_review_notes.pdf`: required CI; parallel bug-finding agents; verifier votes that filter and rank findings; optional security review; risk-based human escalation; checks against the current target branch; and post-merge monitoring with quick rollback. Each stage has a cost or frequency setting. These are configurable extensions, not a requirement to reproduce the full workflow in the first MVP.

`verify_then_merge`: once all requirements are satisfied, the server checks the target branch head before moving it.

- If the node's parent is still the target branch head, it can fast-forward after the required checks.
- If `main` or the selected parent branch has moved, the node stays verified with `reason = "needs_rebase"`. The author rebases onto the current target head, resolves any conflicts, and resubmits. The new node points at the old one through `supersedes`. The server never creates a merge commit to carry a stale branch forward.
- After the fast-forward, a `postmerge` job runs the tests and metrics on the new head. If the tests fail, the server reverts the change and marks the node `reverted`.

`merge_then_verify` is a later policy mode: after checking that the node is based on the current target head, the server lands an eligible node and evaluates it on `main`. If the target moved, the author rebases and resubmits first. A failed evaluation reverts it. Paths that need a human or reviews still wait. Whether to include this mode in a later comparison is decided with the study design.

Human override: `fervo merge n_57 --reason "..."`, `fervo veto n_57 --reason "..."` and `fervo revert n_57 --reason "..."` work for human tokens only. Each one writes a human verdict and an event, so overrides show up in the record and in the study. A human merge still requires the node to be based on the current target head.

Merges are serialised by the server's write lock, so two policy decisions can never race to move `main`.

## 9. The runner and its jobs

`fervo runner --remote <url> --concurrency 2` reads its token from `FERVO_TOKEN` and provider keys from the operator's runner environment or keychain. The runner's model adapters include Anthropic and OpenAI and can address the chosen cheaply hosted model through its configured endpoint. Keys never go to the server, the repo or any log.

The loop:

1. `POST /jobs/lease {"kinds": [...]}` long-polls for 30 seconds and returns a job or nothing.
2. While the job runs, the runner sends a heartbeat every 30 seconds to extend the job's lease. If the runner dies, the lease lapses and the job returns to the queue. After three attempts, it is marked `failed`.
3. `POST /jobs/{id}/result` sends the verdicts. The server accepts them only from the runner that holds the lease.

The job kinds:

- `claim_review`: reviews a claim's intent, scope and overlaps in the runner. The basic profile returns structured advice; policy can require a passing claim verdict before submit. The claim remains visible and the review has its own cost cap.
- `baseline`: runs each metric `baseline_samples` times on `main`.
- `eval`: fetches the node and parent refs into fresh worktrees. It runs `tests.cmd` with its timeout and rejects a failing node. Then it runs each metric on node and parent in paired, interleaved repetitions (three pairs by default), using the same held-out inputs for each pair. The judge compares node and parent three times in each order through a model from a provider other than the author's. The runner posts the test, paired metric, and judge verdicts with their samples and recipe hashes.
- `review`: runs the configured pre-merge review stages in the runner and posts pass/fail verdicts with evidence. The basic profile uses one model review; a richer profile can add CI, parallel bug finding, verifier voting, security review and risk-based escalation, with spending caps and stage settings.
- `summary`: writes the optional prose briefing for `fervo context --summary` (section 10).
- `postmerge`: runs the tests and metrics on the new `main` head.

The commands always come from `main`'s `fervo.toml`, never from the node's copy, and the benchmark files are pinned, so a node cannot change how it is measured.

The judge template and held-out inputs live in the operator's runner configuration, outside the published package and agent clones. Agents can see the public scoring dimensions, but not the exact rubric or held-out inputs. The runner records a hash of the template text and model id in each verdict. The judge receives the goal; declared intent and scope; changed paths; the diff, bounded by a token budget; and measured results. It compares node and parent in both presentation orders and returns a structured preference, scope finding, overreach findings and rationale. The rubric asks whether the change does what it declared and nothing more. The diff is marked as untrusted data. Invalid responses fail the job with a visible reason after a bounded retry.

Review templates also live with the runner. They return pass/fail, evidence and any findings needed by the configured review stages.

Running code that agents wrote is the biggest security exposure in the system. In the MVP, the runner runs each command in a subprocess with a timeout, inside its own worktree, and the docs tell operators to run the runner in a container or VM with no keys mounted except the provider keys. Running the commands themselves in a container with no network, and with no access to the keys at all, is the first plugin worth writing after the MVP.

## 10. Context

`fervo context` is the call agents make most. It returns a bounded JSON object built from SQL, with a version and stable field names.

```json
{
  "goal": "Streaming parser API; keep the public interface stable",
  "metrics": [{"name": "throughput", "direction": "max", "weight": 0.6}],
  "main": {"commit": "a1b2c3d", "node": "n_40", "score": 0.91},
  "frontier": [{"node": "n_42", "score": 0.95, "interval": [0.93, 0.97],
                "intent": "...", "author": "claude-2", "ref": "refs/fervo/nodes/n_42"}],
  "claims": [{"lease": "l_7", "by": "codex-1", "scope": ["src/lexer/tokens.py"],
              "intent": "...", "since": "..."}],
  "tried": [{"node": "n_51", "intent": "...", "outcome": "within_noise"},
            {"node": "n_49", "intent": "...", "outcome": "rejected", "reason": "touched pinned path bench/"}],
  "rules": {"pinned": ["bench/**", "bench.py", "fervo.toml"],
            "requirements_by_path": {"docs/**": ["tests"], "src/auth/**": ["human"], "*": ["tests", "frontier_gain", "review"]}},
  "mine": {"leases": [], "updates": [{"node": "n_44", "event": "needs_rebase"}]},
  "frontier_version": 1832
}
```

The defaults are the top 10 frontier nodes and the 20 most recent tried directions whose labels have not expired. `--scope src/lexer/` narrows `claims` and `tried` to entries that overlap that scope. `mine.updates` lists what changed for this actor since its previous context call, through a cursor into `events`.

`--summary` adds a prose briefing written by the runner. Summaries are cached by `frontier_version`, so ten agents asking at the same moment trigger one model call. On a cache miss, the call returns at once with `"summary": {"status": "pending", "job": "j_x"}`, and the next call picks the summary up.

Overlap between scopes: two scopes overlap if one's directory prefix contains the other's, or if both match a common file in `git ls-tree` of the parent commit. The first test catches new files, and the second is exact for existing ones. Overlaps are reported both at claim time and in context, and they are never refused.

## 11. Plugins

Plugins are TypeScript modules loaded from explicit package configuration and implement one of four small interfaces:

```ts
interface VerdictProducer { // runner
  name: string;
  jobKind: string;
  run(job: Job, workspace: string, providers: Providers): Promise<VerdictIn[]>;
}
interface PolicyRule { // server; pure, no I/O
  name: string;
  evaluate(node: Node, verdicts: Verdict[], config: Config): Satisfied | Pending | Failed;
}
interface ContextProvider { // server; output under context.extras[name]
  name: string;
  contribute(actor: Actor, query: ContextQuery, db: ReadOnlyDB): Record<string, unknown>;
}
interface View { // server; mounted at /ui/<name>
  name: string;
  router(): HttpHandler;
}
```

The built-ins (`tests`, `metric`, `judge`, `review`, `frontier_gain`, `contributor_review`, `human` and the default view) are written against these same interfaces. That is our test that the interfaces are enough: if we cannot build a built-in as a plugin, the interface is wrong. A GitHub Actions bridge, a security scanner, or a long-lived reviewer agent per component would each be one verdict producer.

## 12. GitHub import and mirror

`fervo import github.com/owner/repo [--mirror] [--eval-open-prs]` runs on the server machine with `GITHUB_TOKEN` in the environment. In order:

1. `git clone --bare` with all branches and tags into `repo.git`, then install the hook.
2. Create `n_0` at `main`'s head and enqueue the baseline job.
3. For each open pull request, fetch `refs/pull/N/head` into `refs/heads/import/pr-N` and create a node. Its author is an imported human actor `gh:<login>` (or an agent actor if the account is a bot), its intent is the PR title plus the start of its body, and its state is `submitted`. With `--eval-open-prs`, eval jobs are enqueued too.
4. For each review on those PRs, add a human verdict: `APPROVED` becomes pass, `CHANGES_REQUESTED` becomes fail, and the review body becomes the evidence.
5. Write a starter `fervo.toml` with `[goal]` and `[tests]` left as TODO, which the operator fills in.

`--mirror` adds a `github` remote, and the server pushes `main` to it after every move. Failures are logged and retried with backoff, and they never block a merge. A team can try Fervo while GitHub stays the source others see.

Stretch goals, in order: issues as an open backlog that appears in context, CODEOWNERS and branch protection turned into commented `[[merge.rules]]`, and GitHub Actions results as a verdict producer.

## 13. The agent side: CLI, SKILL.md and UI

The planned CLI surface, delivered in stages:

```
setup (humans):   fervo init · serve · actor add|list|disable · baseline · runner · import · skill install
agents:           fervo context · claim · release · submit · status · abandon · clone
humans:           fervo review · merge · veto · revert
plumbing:         fervo hook pre-receive
```

Every command prints JSON. Every mutating command requires `--key`, which becomes the `Idempotency-Key` request header. A rejected node is a successful call that returns `rejected`; transport, authentication and command errors exit non-zero.

SKILL.md is a short map of the agent loop (context, claim, work, submit, status, react) with links to detailed command reference and a few examples. It explains each outcome and the rules: declare before working, read `tried`, pass `--key` on writes, and avoid pinned paths. Working agents do not review their own nodes. `fervo skill install --harness claude-code|codex|pi|openclaw` is a later convenience; the first MVP works through the CLI alone. We check the instructions by giving each harness a task on a toy repo and measuring command errors and needless calls.

The UI tab is served at `/ui` behind a human token. It has three parts:

- the frontier graph, with nodes placed by time and score and coloured by state;
- the list of active claims and recent nodes, with their intents;
- a node panel showing the intent, verdicts and score interval, a link to the diff (`git diff parent..commit`, rendered on the server), and merge, veto and revert buttons.

It is built last. The demo can run on the CLI alone.

## 14. Workstreams and milestones

The two tracks share one API contract and test fixtures. Each person can contribute to either track; the leads coordinate priorities and handoffs for Assignment 6.

- **Package and CLI — Filippo leads in week one.** Migrate the Python prototype to TypeScript. Build the repo manager, CLI, server, storage, Git permissions, runner and the minimum policy needed for an end-to-end loop. Later product work adds richer review profiles, import, mirror and optional UI.
- **Tests, agents, study and reporting — Roshan leads in week one.** Build the end-to-end fixtures and misuse tests, create agents that use the CLI, choose and initialize the target repo, prepare held-out evaluation and write the report. The comparative protocol and baseline arm remain open until the product loop works. Both people help test and implement across tracks.

Milestones. November 19 is the earliest target for a comparative demo; the study can instead become a later benchmark if the package needs more time. Demo Day is 2026-12-03.

1. **Assignment 6, first MVP.** Convert the existing CLI and API contract to TypeScript; implement `init`, `serve`, actors and tokens, push permissions, claim, submit, status, context, a runner evaluation, a review verdict, policy decision and human override. Exit check: scripted agents complete the CLI loop on a test repo and prohibited pushes fail. Filippo leads package implementation; Roshan leads the tests and agent setup.
2. **Evaluation and policy.** Add baseline runs (five by default), three paired node/parent metric runs, a pairwise cross-provider judge in both orders, the noise-aware frontier, review configuration and the required rebase/resubmission path. Verify the scoring and lifecycle with a toy repo.
3. **Product extensions.** Add path rules, richer runner review stages, `fervo import` and mirror, a second merge policy if useful, harness setup and an optional UI tab. A CLI-only demo remains valid.
4. **Study and reporting.** Roshan selects and initializes the target repo and creates the four study agents. After the product loop is stable, run a pilot, decide the comparison baseline arm and budget, then run the study and write up the evidence. Target the November 19 demo only if the pilot supports it; otherwise present the working package and use the study as a later benchmark.

How we work together: one repo, short-lived branches, and each change reviewed by the other person. Until Fervo can host itself, that review happens on GitHub. Moving our own development onto Fervo after milestone 4 would be a good test, if it does not slow us down. We meet twice a week for 30 minutes, and we keep a `DECISIONS.md` in which every choice that changes this plan gets one dated line.

## 15. Decisions and open questions

Decided on 2026-10-27:

1. TypeScript for the entire Fervo codebase; migrate the Python prototype.
2. The runner writes claim and pre-merge review verdicts. Pre-merge review stages are configurable, from a basic MVP check to a workflow with CI, finding verification, security review and risk tiers. Humans retain override verdicts.
3. If `main` or a selected parent branch has moved, the author must rebase onto its current head and resubmit under a new claim and lease.
4. Default sample counts are three per node and five for the measurement baseline.
5. The study agents are two Claude Code agents (Anthropic), Codex (OpenAI), and pi with a cheaply hosted model. Claude Opus is available for runner reviews; pairwise judges use a provider other than the author's.
6. Roshan chooses and initializes the target study repo.

Open: the comparative study's baseline arm and exact protocol. Decide these after the first CLI MVP and a pilot. The measurement baseline used to normalize scores is already specified above and is a separate concept.

## 16. Testing and the study

Tests at three levels, all runnable on a laptop without network or keys:

- Unit tests for the parts where mistakes are silent: normalisation and intervals, outcome classification, path-rule resolution, scope overlap, provider vote counting, idempotent replays.
- Integration tests that start a real `fervo serve` in a temporary directory with a runner that uses a fake provider. The fake judge returns scripted pairwise preferences, and a toy metric prints a number read from a file in the repo, so tests can make a node "better" on purpose. Scripted TypeScript agents commit and call the CLI to run whole scenarios: two overlapping claims, one improvement and one within noise, a merge, a rebased resubmission under a new lease, and a post-merge revert.
- A misuse suite with the four cases from the proposal, plus pushing to `main`, pushing to another agent's branch, a runner trying to push, a replayed key with a different body, and a node that edits `fervo.toml`. Each must be refused or discounted, with a reason in `events`. For the planted-instruction case, the test passes if the judge score with the planted comment stays within noise of the score without it. That one runs against a real model, so it runs nightly rather than on every commit.

A short live smoke test with one real agent runs before every study session.

The study:

- Target repo: chosen and initialized by Roshan. Selection should favor a clear goal, reproducible tests and a measurable benchmark that can be run repeatedly on the available hardware. Record its commit, benchmark noise and runner configuration before comparing arms. A Python library is possible; the Fervo package itself remains TypeScript.
- Held-out tests: written by us before any run, kept outside the repo, and run only by the study scripts on every commit that reaches `main`.
- Agents: two Claude Code agents using Anthropic, one Codex agent using OpenAI, and pi with a cheaply hosted model selected by Roshan. Pin exact model versions and harness settings before the pilot.
- Arms and runs: the comparison baseline arm is undecided. Once chosen, keep the goal text, model versions, token budget and wall-clock time comparable across arms. Fix the pilot and repeat count from measured variance and available budget; do not present an unrun design as a result.
- Cost: the pilot measures agent and runner token use, model latency and review spending. Set the full-run budget from these measurements before starting the comparison.
- Measures, and where each comes from:
  - The metric reached: the held-out benchmark at the final `main`, run 10 times.
  - Duplicates: identical diff hashes, plus blind labels on a sampled set of pairs, independent of Fervo's overlap warnings.
  - Merge conflicts and rebase retries: from `events` in Fervo and corresponding records in the chosen comparison arm.
  - Regressions: held-out test failures on any `main` commit.
  - Human minutes: our own timer log.
  - Orientation tokens: the tokens each agent spends before its first edit in each task, read from the harness session logs.
  - The open assumption: one of us audits policy-approved merges and records whether they would have reverted them.

## 17. Repository layout

```
fervo/
  package.json
  tsconfig.json
  src/
    models.ts          validated request/response schemas (the API contract)
    cli/               JSON commands
    server/            HTTP app, git transport, hook and state writer
    store/             schema, migrations, frontier, overlap and context queries
    policy/            merge policy and built-in rules
    runner/            job loop, worktrees, provider adapters and review stages
    scoring.ts         paired normalization, intervals and outcomes
    plugins.ts         the four plugin interfaces and configured loading
    importer/          later GitHub import and mirror
    ui/                optional tab
  tests/               TypeScript unit, integration and misuse tests
  study/               later configs, held-out tests, run scripts and analysis
  dev_docs/            development plans, reports and proposals
  research/            research notes and source material
  DECISIONS.md
```

Runner-only judge and review templates and held-out inputs are kept outside the published package and study agent clones. The repo can contain public example configuration, but no active secret rubric or held-out test data.

## 18. Risks

- The judge is unreliable or can be gamed. Mitigations: k samples, pinned template and model, measured results only, a capped weight (0.4 by default), and the planted-instruction test. If the pilot shows the judge adds noise without adding signal, we drop its default weight and say so. The "no judge" ablation measures exactly this.
- Running agent-written code on the operator's machine. We document running the runner in a container. Command sandboxing is the first post-MVP plugin.
- Git over HTTP takes longer than planned. We have the SSH and `file://` fallbacks in section 5, and we decide by the end of milestone 2.
- The harnesses behave differently in headless mode. Test Claude Code, Codex and pi against the same CLI tasks before the study, and measure command errors and unnecessary retries.
- The study costs more than we can spend. The pilot gives us the burn rate, and we can shorten the runs before cutting the number of runs, because variance across runs is what makes the comparison credible.
- Scope creep. The core stays at five objects. Anything new goes through the "can it be a plugin?" test, and its answer goes in `DECISIONS.md`.
