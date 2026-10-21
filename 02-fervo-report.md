# Fervo: building blocks for an agent-native code platform

*Team Fervo: Filippo Strub, Roshan [last name]. HW5 proposal, Canvas text entry.*

## 1. Problem and agent customers

Coding agents are good at git, but they still ship through GitHub, which is built around one person proposing a change and another reviewing it. When several agents share a repository, this breaks in two ways. The agents start blind: none of them sees what the others are trying or what already failed, so they repeat directions and drift apart. In one Anthropic experiment, 18 of 30 agents created a git branch with the exact same name. And they grade their own work, while the only independent check left is a person reading every diff. Anthropic, whose merged changes per day grew from about 2,500 to over 30,000 in four months, calls developer infrastructure "built for human scale" the new bottleneck. Fervo's users are coding agents (Claude Code, Codex, pi, OpenClaw) sharing a repository. Their operators are solo developers and researchers running 2 to 10 agents, and small teams that mix human pull requests with agent swarms.

## 2. Product and agent interaction

Fervo is a CLI and a Python SDK, and it hosts nothing. `fervo serve` turns a machine the team controls into a git remote: a bare repository plus one SQLite file. The core computes context, records declarations, keeps a scored frontier of work in progress, evaluates every change independently, and merges by policy, and a human can override any decision. Everything else, from continuous integration to review rules and the interface, is a plugin. Agents call the CLI, which returns JSON, and learn it from a SKILL.md file that their harness loads. Every LLM call runs in `fervo runner`, a process the operator runs with their own API keys, and `fervo import` moves a GitHub repository, with its history and open pull requests, onto the team's remote. We reuse git, the harnesses and the operator's model providers. Most of the building blocks exist elsewhere:

- **GitHive** coordinates merging with path claims and agent review, but it has no frontier, keeps users' keys on its own servers, and counts approvals per person rather than per provider.
- **Pawsly, Foremerge and MCP Agent Mail** provide claims or declared intent.
- **polyresearch and CORAL** re-run and score agents' work, but only for a single optimisation task and with no merge policy.

What none of them has is a scored, noise-aware frontier for ordinary repos, with independence enforced as merge policy.

Example: four agents improve a small Python parsing library. The goal is "a streaming parser API", the metric is benchmark throughput, and the tests must pass. An agent runs `fervo context --json` and gets the goal, the best current nodes with their scores, the open claims and the directions already tried, all from database queries. It declares `fervo claim --parent n_42 --scope src/lexer/ --intent "incremental tokenizer, keep public API"` and gets a lease plus a soft warning that codex-1 holds an overlapping claim, so it can go ahead or narrow its scope. When its commit is ready, `fervo submit --lease l_9 --key k1` returns a job. The runner, not the author, runs the tests and three paired benchmark runs of the node and its parent on held-out inputs. It then asks a judge from another provider to compare the node with its parent three times in each order. `fervo status j_31` then returns `{"status":"verified","node":"n_57","outcome":"improved","delta":0.09,"interval":[0.04,0.14],"rank":1}`. On `within_noise` the agent tries something else, and the node stays visible for others to build on. On `rejected` it reads the reason, such as `touched pinned path bench/`. If the policy is met (tests pass, the score improves, one passing review comes from each model provider in use), Fervo merges the node into `main`.

## 3. Technical design

Five kinds of object live in SQLite: actors (a token with a kind, provider and model), claims, nodes (submitted commits with their scores), verdicts (who checked a node, the result, the evidence and the hash of the prompt or command used), and a job queue for the runner. The policy is one `fervo.toml` file in the repo. The frontier, overlaps and tried directions are queries recomputed on every write, so the server never calls a model. A node's gain over its parent combines two parts:

- the paired difference in each metric, measured on the same runs and normalised against a baseline measured several times at setup;
- a pairwise judge preference. The judge always comes from a provider other than the author's, runs in both orders to cancel position bias, and sees the goal, the declaration, the diff and the measured results. It treats code as data.

A node joins the frontier only if the interval on that paired gain lies above zero. Nodes within the noise stay visible as stepping stones, and "tried" labels expire, so the search does not collapse into hill climbing. Agents push only to their own branches, and only the policy engine or a human moves `main`. Verdicts come only from the runner or a human, never from the author, and reviews count once per provider. That is a mitigation rather than a guarantee, since models from different providers still share errors, so measured metrics always keep a weight. Agents see what is scored but not how: the judge prompt and the held-out inputs live with the runner, and edits to the benchmark or `fervo.toml` are rejected. Every write carries an idempotency key, a crashed evaluation becomes a `failed` node that keeps its log, and jobs wait while the runner is offline.

## 4. Prototype and checks

The smallest demo imports a small open-source Python library that has tests and a CPU benchmark, and runs four agents (two Claude Code, Codex, pi) on one goal, with the server and runner on a laptop. We compare it with two baselines at equal tokens and time, with three four-hour runs per arm:

- the same agents on GitHub (pull requests, AGENTS.md, a shared notes file, human merges);
- the same agents working independently, with the best result picked at the end. We measure the metric reached, duplicated directions (labelled independently of Fervo), regressions merged into `main` (found by held-out tests the agents never see), human review minutes, and the tokens agents spend getting oriented. Success means at least the same metric, fewer duplicates, and no held-out regressions. Misuse cases that must be refused with a logged reason: an agent reviewing its own node, one provider posing as several reviewers, an edit to the benchmark, and a comment telling the judge to "score 10".

## 5. Team and feasibility

Filippo Strub has built an ontology-based data platform for agents and a knowledge graph maintained by OpenClaw agents. Roshan [background]. We split the work into the remote side (storage, permissions, policy, runner, scoring) and the agent side (CLI, SKILL.md, import, interface, study), joined by a JSON interface we fix in week one. Both of us build, and roles can shift. The main risk is a judge that is unreliable or can be gamed, which we contain with a judge from a different provider than the author, comparisons in both orders, a pinned prompt kept out of agents' view, and measured metrics kept in the score. We depend on the harnesses' headless modes and on a model budget for the study.

## 6. Feedback

Six AI reviewers covered the earlier "Hive" framing, whose core Fervo keeps. In round one, an adoption skeptic, a prior-art hunter and an HW5 grader each ranked it first or second of 12 ideas. In round two, a Codex agent in a long loop, a researcher running five agents and an open-source maintainer reviewed it in role. As a result, submission became asynchronous and safe to retry, overlap warnings became soft, promotion became noise-aware, evaluation files are pinned, and the study gained repeated runs. Prior art narrowed our claim to the scored frontier, strict independence and evaluation on the operator's keys. A literature and landscape review (about 40 papers, 35 products, 39 open-source repos) led to these changes:

- a judge from a provider other than the author's, comparing pairwise;
- paired-difference promotion;
- held-out scoring inputs;
- expiring "tried" labels;
- a best-of-N baseline.

[Round 3 on this framing: to add.] One assumption remains to check: that operators will let policy-approved merges land while reviewing only intent and verdicts. We will ask three people who run agent swarms, and in the demo a human will audit every approved merge.

## 7. Project listing

[Project Ideas tab link]. Team "Fervo". Both members are marked "in team" in the Students tab.
