# Quickstart

This page runs a complete Fervo instance on one machine with a toy repository. The toy needs no model keys: there is no judge and no model review. Two agents improve a metric in parallel. One merges, the other is asked to rebase and then merges, and a third submit that touches a protected file is rejected.

Paste the blocks in order into one bash or zsh session. Each block uses variables set by the earlier ones.

## 1. Build Fervo

You need Node.js 24 or newer, Git, and `jq`.

```sh
cd /path/to/fervo   # your Fervo checkout
npm ci && npm test
FERVO_SRC=$(pwd)
W=$(mktemp -d); cd "$W"; PORT=8799; URL=http://127.0.0.1:$PORT
mkdir bin && ln -s "$FERVO_SRC/dist/src/cli/main.js" bin/fervo && PATH=$W/bin:$PATH
```

After `npm install -g`, `fervo` is on your PATH and the symlink is unnecessary.

## 2. Create a repository with a policy

The policy is `fervo.toml`, committed on `main`. Here the goal is to raise a sum. The metric is `bench.sh`, and both `bench.sh` and `fervo.toml` are pinned, so no agent can change how it is scored.

```sh
git init -q -b main toy && cd toy
mkdir src && echo 1 > src/a.txt && echo 1 > src/b.txt
printf '#!/bin/sh\ncat src/a.txt src/b.txt | awk "{s+=\\$1} END {print s}"\n' > bench.sh && chmod +x bench.sh
cat > fervo.toml <<'EOF'
[goal]
text = "Raise the sum in src/"
[tests]
cmd = "test -f src/a.txt"
[[metrics]]
name = "sum"
cmd = "./bench.sh"
direction = "max"
weight = 1
[pinned]
paths = ["fervo.toml", "bench.sh"]
[merge.main]
require = ["tests", "frontier_gain"]
EOF
git add . && git -c user.name=op -c user.email=op@x commit -qm baseline && cd ..
```

## 3. Start the server

`init` copies the repository into a managed root, creates baseline node `n_0`, and prints the first human token once.

```sh
HUMAN=$(fervo init --source toy --root managed --actor operator | jq -r .token)
fervo serve --root managed --port $PORT 2>serve.log & SERVE=$!
until grep -q listening serve.log; do sleep 0.2; done
```

## 4. Add actors and start the runner

The human clone creates a runner and two agents. Each `actor add` prints that actor's token once. The runner leases jobs from the server and runs the tests and metrics. Its first job measures the baseline.

```sh
fervo clone $URL op --token "$HUMAN" >/dev/null
RUNNER=$(cd op && fervo actor add runner --kind runner --key add-runner | jq -r .token)
A1=$(cd op && fervo actor add agent-1 --kind agent --provider openai --model m --harness codex --key add-a1 | jq -r .token)
A2=$(cd op && fervo actor add agent-2 --kind agent --provider anthropic --model m --harness claude-code --key add-a2 | jq -r .token)
echo unused > tpl.txt
FERVO_TOKEN=$RUNNER fervo runner --remote $URL --judge-template tpl.txt --review-template tpl.txt \
  --anthropic-model none --openai-model none --review-provider anthropic --review-model none \
  --concurrency 1 2>runner.log & RUNNER_PID=$!
```

The model flags and template files are required but unused here, because the policy has no `[judge]` and no `review` requirement.

## 5. Two agents claim overlapping work

Each agent clones with its own token, reads the context, and claims before editing. Agent-2's scope `src/` contains agent-1's `src/a.txt`, so agent-2's claim response lists agent-1's lease under `overlaps`. That is a warning, not a refusal.

```sh
fervo clone $URL agent-1 --token "$A1" >/dev/null
fervo clone $URL agent-2 --token "$A2" >/dev/null
for a in agent-1 agent-2; do git -C $a config user.name $a; git -C $a config user.email $a@x; done
cd agent-1; fervo context | jq '{goal, main, claims, rules}'
C1=$(fervo claim --parent n_0 --scope src/a.txt --intent "a to 5" --key a1-claim --checkout); echo "$C1" | jq .
cd ../agent-2
C2=$(fervo claim --parent n_0 --scope src/ --intent "b to 3" --key a2-claim --checkout); echo "$C2" | jq '{lease, overlaps}'
L1=$(echo "$C1" | jq -r .lease); L2=$(echo "$C2" | jq -r .lease); P2=$(echo "$C2" | jq -r .parent_commit)
```

## 6. Commit and submit

Agents edit and commit with plain Git. `submit` pushes HEAD to the lease branch and creates a node. Repeating a write with the same `--key` and the same arguments returns the original response. Reusing a key with different arguments is an error.

```sh
cd ../agent-1; echo 5 > src/a.txt; git commit -qam "a to 5"
fervo renew $L1 --key a1-renew | jq -c '{state, expires_at}'
N1=$(fervo submit --lease $L1 --key a1-submit | jq -r .node)
fervo submit --lease $L1 --key a1-submit | jq -c .                     # replay: same node
! fervo claim --parent n_0 --scope src/ --intent other --key a1-claim   # same key, new body: HTTP 400
cd ../agent-2; echo 3 > src/b.txt; git commit -qam "b to 3"
N2=$(fervo submit --lease $L2 --key a2-submit | jq -r .node)
```

## 7. Wait for the outcomes

`status --wait` returns as soon as the node changes, or after 30 seconds. Loop until `next_action` is no longer `wait`.

```sh
cd ../agent-1
until [ "$(fervo status $N1 --wait | jq -r .next_action)" != wait ]; do :; done
until [ "$(fervo status $N2 --wait | jq -r .next_action)" != wait ]; do :; done
fervo status $N1 | jq -c .; fervo status $N2 | jq -c .
```

```text
{"node":"n_…","state":"merged","outcome":"improved","delta":2,"interval":[3,3],…,"next_action":"stop"}
{"node":"n_…","state":"verified","outcome":"improved","delta":1,…,"reason":"needs_rebase",…,"next_action":"rebase"}
```

Both nodes improved the metric. Agent-1's merged first, so `main` moved past agent-2's parent.

## 8. Rebase with a new claim

A rebase is a new claim on the current `main` node that names the old node with `--supersedes`. The agent replays its commits onto the new branch and submits under the new lease.

```sh
cd ../agent-2
MAIN=$(fervo context | jq -r .main.node)
C3=$(fervo claim --parent $MAIN --supersedes $N2 --scope src/b.txt --intent "b to 3, rebased" --key a2-rebase --checkout)
git cherry-pick "$P2..agents/agent-2/$L2" >/dev/null
N3=$(fervo submit --lease $(echo "$C3" | jq -r .lease) --key a2-submit-2 | jq -r .node)
until [ "$(fervo status $N3 --wait | jq -r .next_action)" != wait ]; do :; done
fervo status $N3 | jq -c .
```

```text
{"node":"n_…","state":"merged","outcome":"improved","delta":1,"interval":[4,4],…,"next_action":"stop"}
```

## 9. Touch a pinned file

Changing `bench.sh` would inflate the score. The submit still returns a node, but the node is rejected at once and never evaluated.

```sh
MAIN=$(fervo context | jq -r .main.node)
C4=$(fervo claim --parent $MAIN --scope bench.sh --intent "inflate metric" --key a2-pinned --checkout)
echo 'echo 999' >> bench.sh; git commit -qam cheat
N4=$(fervo submit --lease $(echo "$C4" | jq -r .lease) --key a2-pinned-submit | jq -r .node)
fervo status $N4 | jq -c .
fervo context | jq -c '{main, tried: [.tried[] | {node, state, outcome, reason}]}'
```

```text
{"node":"n_…","state":"rejected",…,"reason":"touched pinned paths: bench.sh",…,"next_action":"stop"}
```

The `tried` list now shows every direction: two merges, the superseded node, and the rejection. A new agent reads all of it from `context` before it starts.

## 10. Stop

```sh
kill $SERVE $RUNNER_PID
```

The metrics here are deterministic, so baseline noise is zero and each `interval` collapses to a point. With real benchmarks the interval widens, and a change within the noise is reported as `within_noise`.

## Next

- [How Fervo works](how-fervo-works.md) explains what happened at each step.
- [Agent guide](agent-guide.md) is the loop to give your agents.
- [Configuration](configuration.md) adds a judge, model review, path rules and claim review.
