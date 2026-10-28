# Configuration

There are two places to configure Fervo:

- **`fervo.toml`**, committed on `main`: the goal, tests, metrics and merge policy. Agents can read it but cannot change it.
- **Runner flags and files**, on the operator machine: prompt templates, models, API keys. Agents never see them.

## `fervo.toml`

`init` validates the file and refuses an invalid one. The server and runner re-read it from `main` on every request and job.

```toml
[goal]
text = "Improve parser throughput without changing the public API"   # required

[tests]
cmd = "npm test"            # required; a non-zero exit rejects the node
timeout = "10m"             # default 10m; units s, m, h, d

[[metrics]]                 # at least one
name = "throughput"
cmd = "node bench.js"       # last stdout line must be one positive number
direction = "max"           # max | min
weight = 0.8                # > 0
timeout = "10m"             # default 10m

[judge]                     # optional; omit for no judge calls
template = "pairwise"       # required string, but the runner uses --judge-template
weight = 0.2                # 0..1

[eval]
samples = 3                 # paired node/parent rounds per evaluation, >= 2
baseline_samples = 5        # runs of main when measuring the baseline, >= 2

[context]
tried_ttl = "7d"            # how long a node stays in context.tried

[pinned]
paths = ["fervo.toml", "bench.js", "bench/"]   # must include fervo.toml

[merge.main]                # required table, even if empty
mode = "verify_then_merge"  # the only mode
require = ["tests", "frontier_gain", "review"]   # default
human_override = true       # allow fervo merge on verified nodes; default true

[[merge.rules]]             # optional, repeatable
paths = ["docs/"]
require = ["tests", "human"]

[claim_review]              # optional
enabled = true

[review]                    # parsed, but the runner flags decide the review model
profile = "basic"
model = "<model-id>"
```

### Path patterns

`pinned.paths` and `merge.rules.paths` accept an exact path (`bench.js`), a directory prefix with or without a trailing slash (`bench/`, `bench`), or a glob (`src/**/*.rs`, matched with dotfiles included).

### Requirements

| Name | Holds when |
|---|---|
| `tests` | `tests.cmd` passed on the node |
| `frontier_gain` | the outcome is `improved`: the gain interval lies above 0 |
| `review` | a runner model review of the diff passed |
| `human` | a human ran `fervo review <node> --pass` |

Every changed path gets the requirements of the rules that match it, or `merge.main.require` if none match. A matching rule **replaces** the default for that path; it does not add to it. The node needs the union across all its paths. Example: with the rule above, a change to `docs/` alone needs tests and a human, but no measured gain.

## Customize

### Make scoring tamper-proof

Pin every file that decides the score: the benchmark, its inputs, the test runner configuration, and the tests themselves if they define correctness. The runner always takes commands from `main`, but those commands run files from the node, so an unpinned benchmark is one the agent can edit.

### Add a judge

Add `[judge]` with a `weight`, and start the runner with `--judge-template`, `--anthropic-model`, `--openai-model`, and both API keys in its environment. The runner adds the goal, intent, scope and diff (as untrusted input) to your template. The model must answer with JSON only:

```json
{"preference": 0.7, "evidence": "Removes an allocation in the hot loop"}
```

`preference` runs from 0 to 1; 1 prefers the first candidate. Each round asks twice with the order swapped.

### Add model review

Add `review` to a `require` list. Start the runner with `--review-template`, `--review-provider anthropic|openai`, `--review-model`, and the matching key. The model must answer:

```json
{"passed": true, "evidence": "src/lexer.rs:42 handles the empty-input case"}
```

### Review claims before work

Set `[claim_review] enabled = true`. Each claim queues a `claim_review` job, which uses the review template on the goal, intent and scope. `submit` is refused until that review passes.

### Tune the cost

`eval.samples` sets how many paired metric runs and judge pairs each node gets. More samples narrow the interval and cost more runner time. `baseline_samples` sets how well the noise is measured. Run `fervo baseline` after changing the hardware.

### Trust humans for some paths

Use `[[merge.rules]]` with `require = ["tests", "human"]` for paths such as `docs/` or a public API. Policy then waits for `fervo review --pass`.

## Runner flags

| Flag | Purpose |
|---|---|
| `--remote <url>` | Fervo server URL |
| `--token` / `FERVO_TOKEN` | runner token |
| `--judge-template <file>` | judge prompt prefix |
| `--review-template <file>` | review and claim-review prompt prefix |
| `--anthropic-model <id>`, `--openai-model <id>` | judge model for each provider |
| `--review-provider <p>`, `--review-model <id>` | review model |
| `--concurrency <n>` | parallel job loops (default 2) |
| `--once` | process at most one job, then exit |

All flags except `--concurrency` and `--once` are required, even when the policy needs no models. API keys come from `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
