# Fervo

Fervo manages agent contributions to one Git repository. The server owns the bare repo and SQLite state; the runner executes tests and model reviews with operator-owned keys; contributors use Git and the JSON CLI.

## Build and test

Node.js 24 or newer and Git are required.

```sh
npm ci
npm test
```

The package exposes `fervo` after installation. In a source checkout, use `node dist/src/cli/main.js` in place of `fervo` below.

## Prepare the source repository

Commit `fervo.toml` on `main` before initialization. Every metric must print one positive number on its last output line. The server and runner read this file from `main`, and `fervo.toml` must be pinned.

```toml
[goal]
text = "Improve the parser without changing its public API"

[tests]
cmd = "npm test"
timeout = "10m"

[[metrics]]
name = "throughput"
cmd = "node bench.js"
direction = "max"
weight = 0.8

[judge]
template = "pairwise"
weight = 0.2

[eval]
samples = 3
baseline_samples = 5

[pinned]
paths = ["fervo.toml", "bench.js"]

[merge.main]
require = ["tests", "frontier_gain", "review"]
human_override = true
```

The tests and metrics run from the committed main-branch configuration. Keep judge and review prompt templates outside the managed repo.

## Start the service

```sh
fervo init --source ./project --root ./managed --actor operator
fervo serve --root ./managed --host 127.0.0.1 --port 8765
```

`init` creates `managed/repo.git`, `managed/.fervo/fervo.db`, a pre-receive hook, baseline node `n_0`, and a baseline job. It prints the first human token once. The root directory must not already exist. The HTTP listener is intended for localhost or a TLS reverse proxy.

In another shell, use the human token to create actors:

```sh
FERVO_TOKEN=<human-token> fervo clone http://127.0.0.1:8765 ./operator-clone
cd operator-clone
fervo actor add runner --kind runner --key create-runner
fervo actor add agent-1 --kind agent --provider openai --model <model-id> --harness codex --key create-agent-1
```

Each `actor add` prints its token once. Run the operator-side runner with its own token and provider keys:

```sh
FERVO_TOKEN=<runner-token> OPENAI_API_KEY=<key> ANTHROPIC_API_KEY=<key> \
  fervo runner --remote http://127.0.0.1:8765 \
  --judge-template /operator/judge.txt --review-template /operator/review.txt \
  --anthropic-model <model-id> --openai-model <model-id> \
  --review-provider anthropic --review-model <model-id> --concurrency 2
```

The runner uses a provider different from the author's for pairwise judging. It runs agent-authored code in local worktrees; operate it in a container or VM with only the keys it needs.

## Agent loop

```sh
FERVO_TOKEN=<agent-token> fervo clone http://127.0.0.1:8765 ./agent-clone
cd agent-clone
fervo context
fervo claim --parent n_0 --scope src/ --intent "Improve parser" --key claim-1 --checkout
# edit and commit with Git
fervo submit --lease <lease-id> --key submit-1
fervo status <node-id> --wait
```

Each write needs a unique `--key`; replaying the same key and body returns the original response. `status` reports `next_action`. If it says `rebase`, create a new claim with `--parent <current-main-node> --supersedes <old-node>`, rebase the change and submit under that new lease. `fervo renew <lease-id> --key <key>` extends a long-running claim. Human commands `merge`, `veto`, `revert`, and `review` record overrides.

`skill/SKILL.md` gives coding agents the short form of this workflow.
