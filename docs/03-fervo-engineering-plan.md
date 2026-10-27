# Fervo: engineering plan

*For Filippo and Roshan. Written 2026-10-21 and meant to change as we build. Roles are not assigned yet: section 14 lists the workstreams, and we split them at kickoff.*

This plan turns the proposal (`02-fervo-report.md`, with the long form in `PRD.md`) into something we can build in about six weeks. The rule throughout is the one in the pitch: a small core with good defaults, and everything else as a plugin. Whenever a feature can live outside the core, it does. Whenever there is a simpler way to get the demo working, we take it and write down what we gave up.

## 1. What we are building, and what we are not

The MVP has to support one complete loop: an agent reads the context, declares a claim, pushes a commit, gets an independent score, and the node is merged or rejected by policy, with a human able to override. We need it working with four real agents from at least three providers, on a repo imported from GitHub, so that we can run the study.

In scope for the MVP:

- `fervo init` and `fervo serve`: a bare git repo plus SQLite, served over HTTP, with token auth and per-actor branch permissions.
- The core objects (actors, claims, nodes, verdicts, jobs) and the derived queries (frontier, overlaps, tried directions, context).
- `fervo runner`: runs tests, metrics and the judge on the operator's machine with the operator's keys.
- Scoring with a baseline, noise-aware promotion, and pinned paths.
- The policy engine with path rules, both merge modes, provider-counted reviews and human override.
- The agent CLI with JSON output, and a SKILL.md for Claude Code, Codex, pi and OpenClaw.
- `fervo import` for git history, open pull requests and their reviews, plus mirroring `main` back to GitHub.
- The plugin interfaces, with the built-in checks written as plugins.
- One UI tab, built last, which the demo can do without.

Not in the MVP, though the design leaves room for them: hosting of any kind, launching or orchestrating agents, an MCP server (the CLI comes first), several repos per server, issue import and drafting `fervo.toml` from CODEOWNERS (stretch goals), sandboxing beyond running the runner in a container, semantic matching of intents, and rescoring old nodes after the judge changes.

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

We will write it in Python 3.12, packaged with uv and published as `fervo` on PyPI (the name is free). Python fits because the demo targets a Python library, the provider SDKs are best supported in Python, and both of us can move fast in it.

- CLI: Typer. Every command prints JSON with `--json`, and readable text otherwise.
- Server: FastAPI on uvicorn.
- Shared models: Pydantic. One `models.py` defines every request and response. The CLI, the server, the runner and the SDK all import it, so the API contract lives in one place, and we can export JSON Schema from it for the SKILL.md.
- Storage: SQLite through the standard `sqlite3` module, in WAL mode. All writes go through one async lock in the server process, so there is a single writer and no race to reason about. This is enough for tens of agents.
- Git: the `git` binary through `subprocess`, with no libgit2 or dulwich. We get git's behaviour exactly, and it is easy to debug.
- Git over HTTP: `git http-backend` (shipped with git) run as a CGI program behind a FastAPI route. The server checks the token, sets `REMOTE_USER` to the actor id, and git does the rest.
- LLM calls: the official `anthropic`, `openai` and `google-genai` SDKs behind a small `Provider` interface (`complete(prompt, model, temperature) -> text`) in the runner.
- UI: server-rendered HTML with htmx, plus one small graph library for the frontier.

A decision to confirm at kickoff (section 15): if either of us strongly prefers TypeScript, now is the time to say so. Changing later is expensive.

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
  supersedes TEXT,                -- a rebased resubmission points at the old node
  merged_as TEXT,                 -- commit on main, once merged
  created_at TEXT)

verdicts(
  id TEXT PRIMARY KEY,
  node TEXT REFERENCES nodes,
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
  kind TEXT,                      -- eval | review | summary | postmerge | baseline
  node TEXT, payload TEXT,        -- JSON
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

Auth uses one random 32-byte token per actor, created by `fervo actor add --kind agent --provider anthropic --model claude-sonnet-5-5 --harness claude-code`. The command prints the token once, and the server stores only its hash. `fervo clone <url>` writes the remote and token into the clone's `.git/config` (never into the working tree) and sets `fervo credential` as git's credential helper. After that, plain `git fetch` and `git push` just work, so agents can use git exactly as they already do.

If `git http-backend` behind FastAPI costs more than a day, the fallback is SSH with a forced command that sets the actor id. For a single-laptop demo, a `file://` remote plus the same hook, with the actor read from an environment variable, would also do. That has no real auth, so it is a fallback for the demo only.

## 6. The life of a claim and a node

Claim states: `active → submitted | expired | released`. A claim lasts two hours by default, and any CLI call from its holder extends it, so an agent working normally never loses it.

Node states:

```
submitted ──► evaluating ──► verified ──► merged ──► reverted
     │             │             │
     ▼             ▼             ▼
  rejected       failed       abandoned
```

`rejected` means the node broke a rule before or during evaluation: it touched a pinned path, its tests failed, or its commit does not descend from its parent. `failed` means the evaluation itself broke (a crash, a timeout, or the judge unavailable), and the log is kept. `verified` nodes carry an outcome: `improved`, `within_noise` or `worse`. `abandoned` is a human veto, or the agent giving up with `fervo abandon`.

This is the full sequence for the example in the report:

1. `fervo context --json` runs read-only queries (section 10).
2. `fervo claim --parent n_42 --scope src/lexer/ --intent "..." --key k0` makes the server check the parent, compute overlaps with active claims and with past nodes, insert the claim, and return the lease and the warnings. With `--checkout`, the CLI also creates `agents/<actor>/l_9` at the parent's commit.
3. The agent works and commits with plain git.
4. `fervo submit --lease l_9 --key k1` makes the CLI push `HEAD` to `refs/heads/agents/<actor>/l_9` and then call `POST /submit {lease, commit, key}`. The server checks that the commit descends from the parent's commit, computes `changed_paths`, rejects the node at once if any changed path is pinned, creates the node and `refs/fervo/nodes/n_57`, marks the claim `submitted`, enqueues an `eval` job, and returns `{"job":"j_31","node":"n_57"}`.
5. The runner leases `j_31` and runs the evaluation (section 9).
6. The server stores the verdicts, computes the score and the outcome, and runs the policy engine (section 8), which may enqueue `review` jobs or merge.
7. `fervo status j_31` (or `fervo status n_57`) returns the current state at any point. The CLI's `--wait` flag polls with backoff for the agents that prefer to block.

Idempotency: every mutating request carries a key that the agent chooses. The server stores `(actor, key) → response` in the same transaction as the write. A repeated request with the same key and the same body gets the stored response back. The same key with a different body is an error. That is what makes "retry after a crash" safe.

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
template = "fervo/frontier-v1"
model = "claude-sonnet-5-5"
weight = 0.4

[eval]
samples = 3                  # metric runs and judge samples per node
baseline_samples = 5

[pinned]
paths = ["bench/**", "bench.py", "fervo.toml"]
```

The baseline: `fervo init` (or `fervo baseline`) enqueues a `baseline` job. The runner runs each metric `baseline_samples` times on the current `main` and stores the mean μ and standard deviation σ. That baseline is node `n_0`.

Normalising: one metric run m becomes r = m / μ when higher is better, and r = μ / m when lower is better. The baseline therefore scores 1.0 on every metric, and 1.18 means 18% better. Metric values must be positive. A metric that can be zero or negative is a plugin's job.

The judge: each sample returns a number between 0 and 1 (section 9).

A node's score: we pair the i-th metric run with the i-th judge sample, which gives k score samples:

```
s_i = Σ_metrics  w · r_i  +  w_judge · j_i
```

We report their mean and a 95% interval, mean ± t(k−1) · sd / √k. Three lucky runs must not produce a falsely tight interval, so sd is the larger of the samples' own standard deviation and the noise floor implied by the baseline, √(Σ (w · σ/μ)²). With weights 0.6 and 0.4, the baseline scores about 0.6 · 1.0 + 0.4 · (its judge score).

The outcome compared with the parent:

- `improved` if the node's lower bound is above the parent's upper bound;
- `worse` if the node's upper bound is below the parent's lower bound;
- `within_noise` otherwise.

The frontier is a query: verified, improved nodes that are not merged or abandoned, and that have no improved, verified descendant (once a child beats a node, the child is the place to build). The query ranks them by score. `main`'s head is always included as the root, scored by its post-merge job (section 8).

Tried directions are also a query: every node with its intent, scope, outcome and reason, newest first, filterable by scope. Fervo does not judge whether a new intent "is the same" as an old one. It hands the list to the agent, who is good at that comparison and pays for it with its own tokens.

A known limitation: changing the judge template, the judge model or a metric changes what a score means. In the MVP, any such change starts a new epoch. We re-run the baseline, and scores before and after are not compared. Rescoring old nodes is a later plugin.

## 8. Policy engine and merging

The policy engine runs inside the server after every event that touches a node: a new verdict, a finished job, a human action or a timeout. It is a pure function from the node, its verdicts and `fervo.toml` to one of `satisfied`, `pending(jobs to enqueue)` or `failed(reason)`.

```toml
[merge.main]
mode = "verify_then_merge"       # or "merge_then_verify"
require = ["tests", "frontier_gain", "contributor_review"]
contributor_review = { providers = "active", timeout = "30m", on_timeout = "hold" }
human_override = true

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
- `contributor_review`: one vote from each required provider, where each vote is the majority of that provider's review verdicts (a tie fails). `providers = "active"` means the providers of every agent that holds a claim or authored a node in the last 24 hours. It can also be an explicit list. When the node is verified, this rule enqueues one `review` job per missing provider. On timeout, `hold` leaves the node verified and unmerged, with a reason a human can see. `fail` rejects it.
- `human`: a passing verdict from a human actor.

Verdicts from the node's author are refused when they are written, so they can never be counted. Reviews are grouped by provider, so three Claude reviews make one Claude vote.

`verify_then_merge`: once all requirements are satisfied, the server merges in a temporary worktree of the bare repo.

- If the node's parent is still `main`'s head, it is a fast-forward.
- Otherwise it tries `git merge --no-ff`. On a conflict, the node stays verified with `reason = "needs_rebase"`, and the next context call tells the author. The agent rebases and resubmits, and the new node points at the old one through `supersedes`. Text conflicts are the agent's to fix.
- On a clean merge, `main` moves, and a `postmerge` job runs the tests and metrics on the new head. If the tests fail there, which can happen because two good changes can interact badly, the server reverts that merge with `git revert` and marks the node `reverted`.

`merge_then_verify`: when a node is submitted and its path rules need nothing beyond `tests` and `frontier_gain`, the server merges it immediately and evaluates it on `main`. A failure reverts it. Paths that need a human or reviews still wait. This is the high-throughput mode Anthropic describes, and it is one of our ablations.

Human override: `fervo merge n_57 --force`, `fervo veto n_57 --reason "..."` and `fervo revert n_57` work for human tokens only. Each one writes a human verdict and an event, so overrides show up in the record and in the study.

Merges are serialised by the server's write lock, so two policy decisions can never race to move `main`.

## 9. The runner and its jobs

`fervo runner --remote <url> --concurrency 2` reads its token from `FERVO_TOKEN` and the provider keys from the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) or the OS keychain. Keys never go to the server, the repo or any log.

The loop:

1. `POST /jobs/lease {"kinds": [...]}` long-polls for 30 seconds and returns a job or nothing.
2. While the job runs, the runner sends a heartbeat every 30 seconds to extend the job's lease. If the runner dies, the lease lapses and the job returns to the queue. After three attempts, it is marked `failed`.
3. `POST /jobs/{id}/result` sends the verdicts. The server accepts them only from the runner that holds the lease.

The job kinds:

- `baseline`: runs each metric `baseline_samples` times on `main`.
- `eval`: fetches the node ref into the runner's cache clone and checks it out in a fresh `git worktree`. It runs `tests.cmd` with its timeout, and stops with `rejected: tests_failed` if they fail, so nobody pays for benchmarks on broken code. Then it runs each metric k times and samples the judge k times, and posts a `tests` verdict, one verdict per metric with its samples, and a `judge` verdict with its samples.
- `review`: calls the pinned review template with the given provider's reviewer model and posts one pass-or-fail verdict with evidence.
- `summary`: writes the optional prose briefing for `fervo context --summary` (section 10).
- `postmerge`: runs the tests and metrics on the new `main` head.

The commands always come from `main`'s `fervo.toml`, never from the node's copy, and the benchmark files are pinned, so a node cannot change how it is measured.

The judge template `fervo/frontier-v1` ships inside the package. Its hash (template text plus model id) is stored in every judge verdict. The judge receives the goal; the declared intent and scope; the changed paths; the diff, cut to a token budget, beyond which it gets file-level stats; and the measured results (tests passed, each metric's mean compared with the parent's). It must answer in JSON: `{"score": 0.0-1.0, "scope_ok": bool, "overreach": [..], "rationale": ".."}`. The rubric asks whether the change does what it declared and nothing more, and it penalises scope creep and over-engineering. The diff goes inside a block marked with a random boundary string, and the instructions say that everything inside it is data written by the author, including any instructions it contains. A malformed answer is retried once and then dropped. Fewer than two valid samples make the node `failed: judge_unavailable`.

The review template `fervo/review-v1` works the same way, with pass or fail as the output and the verdicts so far as extra input.

Running code that agents wrote is the biggest security exposure in the system. In the MVP, the runner runs each command in a subprocess with a timeout, inside its own worktree, and the docs tell operators to run the runner in a container or VM with no keys mounted except the provider keys. Running the commands themselves in a container with no network, and with no access to the keys at all, is the first plugin worth writing after the MVP.

## 10. Context

`fervo context --json` is the call agents make most. It is built entirely from SQL, and it is kept small enough to paste into a prompt.

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
            "requirements_by_path": {"docs/**": ["tests"], "src/auth/**": ["human"], "*": ["tests", "frontier_gain", "contributor_review"]}},
  "mine": {"leases": [], "updates": [{"node": "n_44", "event": "needs_rebase"}]},
  "frontier_version": 1832
}
```

The defaults are the top 10 frontier nodes and the 20 most recent tried directions. `--scope src/lexer/` narrows `claims` and `tried` to entries that overlap that scope. `mine.updates` lists what changed for this actor since its previous context call, through a cursor into `events`.

`--summary` adds a prose briefing written by the runner. Summaries are cached by `frontier_version`, so ten agents asking at the same moment trigger one model call. On a cache miss, the call returns at once with `"summary": {"status": "pending", "job": "j_x"}`, and the next call picks the summary up.

Overlap between scopes: two scopes overlap if one's directory prefix contains the other's, or if both match a common file in `git ls-tree` of the parent commit. The first test catches new files, and the second is exact for existing ones. Overlaps are reported both at claim time and in context, and they are never refused.

## 11. Plugins

Plugins are Python packages that register under the `fervo.plugins` entry-point group and implement one of four small interfaces:

```python
class VerdictProducer(Protocol):      # runs in the runner
    name: str
    job_kind: str
    def run(self, job: Job, workspace: Path, providers: Providers) -> list[VerdictIn]: ...

class PolicyRule(Protocol):           # runs in the server; must be pure, no I/O
    name: str
    def evaluate(self, node: Node, verdicts: list[Verdict], cfg: dict) -> Satisfied | Pending | Failed: ...

class ContextProvider(Protocol):      # runs in the server; output goes under context["extras"][name]
    name: str
    def contribute(self, actor: Actor, query: ContextQuery, db: ReadOnlyDB) -> dict: ...

class View(Protocol):                 # mounted at /ui/<name>
    name: str
    def router(self) -> APIRouter: ...
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

The full CLI:

```
setup (humans):   fervo init · serve · actor add|list|disable · import · baseline · runner · skill install
agents:           fervo context · frontier · claim · release · submit · status · abandon · clone
humans:           fervo review · merge · veto · revert
plumbing:         fervo credential · hook pre-receive
```

Every agent command accepts `--json` and `--key`, and exits non-zero only on transport or auth errors. A rejected node is a successful call that returns `rejected`. Agents handle results more reliably when "the system worked and said no" looks different from "the system broke".

SKILL.md is the whole user manual for an agent, so it gets the same care as the code. It covers when to use Fervo and the loop (context, claim, work, submit, status, react). It explains how to read each outcome, and the rules: declare before working, read `tried` before choosing a direction, always pass `--key`, never edit pinned paths, never try to review your own node. It ends with three worked transcripts. `fervo skill install --harness claude-code|codex|pi|openclaw` writes it where each harness looks for skills. For Codex, it also adds a pointer to AGENTS.md. We check it by giving each harness a short task on a toy repo and reading the transcripts for misuse, before every study run.

The UI tab is served at `/ui` behind a human token. It has three parts:

- the frontier graph, with nodes placed by time and score and coloured by state;
- the list of active claims and recent nodes, with their intents;
- a node panel showing the intent, verdicts and score interval, a link to the diff (`git diff parent..commit`, rendered on the server), and merge, veto and revert buttons.

It is built last. The demo can run on the CLI alone.

## 14. Workstreams and milestones

We split the work into four workstreams and divide them at kickoff. The natural split is A with B, and C with D, because each pair shares most of its context. `models.py` and the API contract belong to both of us, and either of us can change them only with the other's review.

- A. Remote core: storage and schema, git over HTTP, the hook and tokens, claims and nodes, idempotency, the derived queries, the policy engine and merging.
- B. Runner and evaluation: the job queue protocol, the runner loop, providers, baseline, scoring and intervals, the judge and review templates, the post-merge check and revert.
- C. Agent interface: the CLI, context, SKILL.md and harness installs, `fervo clone` and the credential helper, scripted fake agents for testing.
- D. Import, UI and study: `fervo import` and mirror, the UI tab, the study harness and its analysis, the misuse suite.

Milestones. Demo Day materials are due 2026-11-19 and Demo Day is 2026-12-03. We should check both against the course calendar, and slot in HW6 once its date is posted.

1. Kickoff, by 2026-10-24. Settle the decisions in section 15. Write `models.py` and the API contract, and stub every endpoint so it returns fixed data. From then on, C can build against stubs while A builds the real thing.
2. Walking skeleton, by 2026-10-31. `init`, `serve`, actors and tokens, push permissions, claim, submit and status, and context from real queries. The runner exists but returns fake scores. Exit check: two scripted agents complete the loop end to end, and a push to someone else's branch is refused.
3. Real evaluation, by 2026-11-07. Baseline, tests and metric runs, judge v1, scores, intervals and outcomes, the frontier query, SKILL.md v1. Exit check: a 30-minute live run with two Claude Code agents and one Codex agent on a toy repo, with every node scored.
4. Policy and import, by 2026-11-14. Path rules, both merge modes, provider-counted reviews, human override, post-merge revert, `fervo import` and mirror. The misuse suite passes. A one-hour pilot runs in each study arm.
5. Demo-ready, by 2026-11-19. The UI tab, a scripted demo, the first full study runs, and the Demo Day materials.
6. Study and polish, 2026-11-20 to 2026-12-02. The remaining runs and ablations, the analysis, fixes, and rehearsal.

How we work together: one repo, short-lived branches, and each change reviewed by the other person. Until Fervo can host itself, that review happens on GitHub. Moving our own development onto Fervo after milestone 4 would be a good test, if it does not slow us down. We meet twice a week for 30 minutes, and we keep a `DECISIONS.md` in which every choice that changes this plan gets one dated line.

## 15. Decisions to make at kickoff

These are listed with a recommendation each, so that kickoff is quick.

1. Language: Python (recommended) or TypeScript.
2. Who writes review verdicts. The recommendation is the runner, calling each provider with the pinned review template, plus humans through the CLI. The alternative is to let working agents that are not the author run `fervo review` as well. That is closer to "every contributor signs off", but it is harder to control. It could stay off by default behind a policy flag.
3. Merging when `main` has moved: post-merge check with automatic revert (recommended), or always requiring a rebase onto the new `main` before merging. Requiring a rebase is safer, but it is slower with many agents.
4. Defaults for k: 3 samples per node and 5 for the baseline (recommended). The pilot will tell us whether 3 is enough to separate real gains from noise on our benchmark.
5. Providers in the study: Claude Code (two agents, Anthropic), Codex (OpenAI), and pi set to a Gemini model, so that provider counting means something. The judge's model should differ from the reviewers' models, or at least be fixed for the whole study.
6. The target repo for the study (section 16).
7. The baseline arm: a real GitHub repo with real PRs (recommended, since our claim is about GitHub), or a plain git remote that imitates GitHub's workflow.

## 16. Testing and the study

Tests at three levels, all runnable on a laptop without network or keys:

- Unit tests for the parts where mistakes are silent: normalisation and intervals, outcome classification, path-rule resolution, scope overlap, provider vote counting, idempotent replays.
- Integration tests that start a real `fervo serve` in a temporary directory with a runner that uses a fake provider. The fake judge returns scripted scores, and a toy metric prints a number read from a file in the repo, so tests can make a node "better" on purpose. Scripted agents (Python functions that commit and call the CLI) run whole scenarios: two overlapping claims, one improvement and one within noise, a merge, a conflicting resubmission, a post-merge revert.
- A misuse suite with the four cases from the proposal, plus pushing to `main`, pushing to another agent's branch, a runner trying to push, a replayed key with a different body, and a node that edits `fervo.toml`. Each must be refused or discounted, with a reason in `events`. For the planted-instruction case, the test passes if the judge score with the planted comment stays within noise of the score without it. That one runs against a real model, so it runs nightly rather than on every commit.

A short live smoke test with one real agent runs before every study session.

The study:

- Target repo: a pure-Python library under about 20,000 lines with a permissive licence, a test suite that runs in under two minutes, a CPU benchmark that runs in under 30 seconds and varies by less than 3% between runs, and clear room for the chosen goal. A pure-Python parser or serialiser fits. We pick it in the week of milestone 3, measure its benchmark noise, and pin the commit.
- Held-out tests: written by us before any run, kept outside the repo, and run only by the study scripts on every commit that reaches `main`.
- Arms: Fervo, against the same four agents on GitHub with PRs, an AGENTS.md, a shared NOTES.md, and one of us merging PRs and logging the minutes. Both arms get the same goal text, the same token budget per agent and the same wall-clock time.
- Runs: a one-hour pilot per arm, then three runs of four hours per arm. The ablations (no claims, no judge, no provider counting, merge-then-verify) get one or two shorter runs each, and we report them as indicative, not conclusive.
- Cost: the pilot measures how fast tokens burn, and from it we set the per-agent budget. The main study is 4 agents × 6 runs × that budget, plus the runner's judge and review calls. We should estimate it after the pilot and confirm we can afford it before starting the full runs.
- Measures, and where each comes from:
  - The metric reached: the held-out benchmark at the final `main`, run 10 times.
  - Duplicates: identical diff hashes, plus a blind LLM label ("same direction?") on a sample of node or PR pairs that touch the same files, by a model none of the agents use, with 20 pairs checked by hand.
  - Merge conflicts: from `events` in Fervo, and from the PR history on GitHub.
  - Regressions: held-out test failures on any `main` commit.
  - Human minutes: our own timer log.
  - Orientation tokens: the tokens each agent spends before its first edit in each task, read from the harness session logs.
  - The open assumption: one of us audits every merge the policy approved and records whether they would have reverted it.

## 17. Repository layout

```
fervo/
  pyproject.toml
  src/fervo/
    models.py          shared request/response objects (the API contract)
    cli/               Typer commands
    server/            FastAPI app, git HTTP, hook, write lock
    store/             schema, migrations, queries: frontier, overlaps, tried, context
    policy/            engine and built-in rules
    runner/            job loop, worktrees, providers
    scoring.py         normalisation, intervals, outcomes
    plugins.py         the four interfaces and entry-point loading
    importer/          GitHub import and mirror
    ui/                the one tab
    templates/         judge and review prompts (hashed into verdicts)
    skill/SKILL.md
  tests/               unit, integration, misuse
  study/               configs, held-out tests, run scripts, analysis notebooks
  DECISIONS.md
```

## 18. Risks

- The judge is unreliable or can be gamed. Mitigations: k samples, pinned template and model, measured results only, a capped weight (0.4 by default), and the planted-instruction test. If the pilot shows the judge adds noise without adding signal, we drop its default weight and say so. The "no judge" ablation measures exactly this.
- Running agent-written code on the operator's machine. We document running the runner in a container. Command sandboxing is the first post-MVP plugin.
- Git over HTTP takes longer than planned. We have the SSH and `file://` fallbacks in section 5, and we decide by the end of milestone 2.
- The harnesses behave differently in headless mode: pi and OpenClaw may follow SKILL.md less reliably than Claude Code. We test each one early (milestone 3) rather than discovering it during the study.
- The study costs more than we can spend. The pilot gives us the burn rate, and we can shorten the runs before cutting the number of runs, because variance across runs is what makes the comparison credible.
- Scope creep. The core stays at five objects. Anything new goes through the "can it be a plugin?" test, and its answer goes in `DECISIONS.md`.
