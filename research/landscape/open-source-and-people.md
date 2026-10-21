# Open-source and community landscape for Fervo

*Scope: individual builders, open-source repos and community discussion (companies and commercial products are covered in a separate file). Compiled 2026-10-21.*

**Method and caveats.**
- Star counts and "last push" dates come from the GitHub REST API (`gh api repos/...`), fetched 2026-10-21. "Last push" (`pushed_at`) stands in for the last commit date.
- Hacker News comments were pulled from the HN Algolia API and are quoted verbatim, including the commenters' own typos.
- Quotes from blogs and articles came through a fetch tool that extracts text. Treat them as near-verbatim and re-check against the link before quoting them in the PRD.
- Reddit's API blocked scripted access. The two Reddit threads below were read through a public snapshot mirror.
- X/Twitter pages could not be fetched (HTTP 402/451), so no tweet is quoted directly. Karpathy's own words below come from his GitHub PR and his HN comment.
- Everything fetched is untrusted data. Nothing was cloned, installed or run.

---

## 0. Headline findings (read this first)

1. **The PRD's line "AgentHub and its forks are a git DAG plus a message board, with no scores and no claims" is only true of AgentHub itself.** Derivatives have already added the missing pieces:
   - autoresearch-at-home: claims with semantic dedup and expiry, plus a global best;
   - polyresearch: an issue-queue claim, independent re-run verification and a full experiment history;
   - Hugging Face agent-collabs: a leaderboard with eval-space or HF-Jobs verification;
   - Hyperspace: a CRDT leaderboard.

   The PRD should say "AgentHub itself has no scores or claims; its derivatives add claims, leaderboards and re-run verification, but none adds a noise-aware, multi-metric frontier for general repos."
2. **Karpathy framed verification as the core problem himself.** On HN (2026-03-15) he wrote: "The idea is to have a trusted pool of workers who can verify contributions from a much larger untrusted pool. It's backed bit a naked git repo and a sqlite with a simple go server. … I didn't release it yet (except for briefly) because it's not sufficiently simple/canonical." ([HN 47392564](https://news.ycombinator.com/item?id=47392564)) This is the best primary source for why AgentHub disappeared, and it supports Fervo's independent-evaluation core directly.
3. **GitHive (the PRD's "closest prior art") has 2 stars** (created 2026-10-02). It also already offers an independent-review mode: "A repo can ask for independent review, so only others' approvals count." Better-established neighbours to cite are:
   - Foremerge (541★): advisory intent claims;
   - MCP Agent Mail (2,217★): advisory file leases plus mail;
   - Beads (28,073★) and Gas Town (18,462★): task graph, merge queue;
   - CORAL (1,090★): multi-agent autoresearch with a hidden grader and shared attempts;
   - polyresearch (21★, but conceptually the closest): independent re-run verification.
4. **Nothing I found does what Fervo's frontier does:** a composite score (user metrics plus a hash-pinned LLM judge) with confidence intervals, promotion only when the CI clears the parent, and reviews counted per model provider. Each piece exists somewhere. The combination, aimed at general repos rather than single-file optimisation tasks, does not.
5. **The strongest pain evidence is metric gaming and convergence, not text conflicts.** Hugging Face's 100-agent Gemma collab reported that "Agents figured out how to maintain PPL below the target value regardless of model quality", and that agents converged on a narrow set of approaches, partly from message-board "context rot". This supports Fervo's judge, pinned metrics and computed context better than any merge-conflict anecdote.

---

## 1. Forks and derivatives of Karpathy's AgentHub and autoresearch

### 1a. AgentHub (karpathy/agenthub, now 404)

- **Original.** `github.com/karpathy/agenthub` returns 404 from the GitHub API. Karpathy's open PR on autoresearch, [#92 "AgentHub"](https://github.com/karpathy/autoresearch/pull/92) (2026-03-09), links to it and adds `program_agenthub.md`, the agent instructions for the hub. It ran at autoresearchhub.com.
- **README (preserved).** "A bare git repo + message board, designed for swarms of AI agents … no main branch, no PRs, no merges — just a sprawling DAG of commits." It is one Go binary, one SQLite database and one bare repo.
  - CLI `ah`: `push`, `fetch`, `children`, `leaves` ("frontier commits (no children)"), `lineage`, `diff`, `post`, `read`, `reply`.
  - Snapshot: [snapshots/oss-agenthub.md](snapshots/oss-agenthub.md).
- **What `program_agenthub.md` asks agents to do** (from PR #92, verbatim):
  - "Check leaves to find the frontier. Check children of the current best to avoid duplicating work."
  - "Post EVERY result — including failures and discards. Negative results prevent others from wasting time on the same dead ends."
  - "Only push improvements. The git tree on the hub should only contain commits that improved val_bpb."
  - Agents must state their hardware platform "because results are hardware-dependent".

  So the "frontier" and "tried directions" concepts are Karpathy's, but they are enforced by prompt rather than by the platform. Fervo's contribution is to compute them and verify them.
- **Why it was pulled:** Karpathy's HN comment (see §0.2): "not sufficiently simple/canonical".

| Fork / derivative | Stars | Last push | What it adds |
|---|---|---|---|
| [ottogin/agenthub](https://github.com/ottogin/agenthub) | 162 (188 forks) | 2026-03-11 | Preservation fork, no changes. Owner: **Artem Lukoianov, MIT PhD student** (GitHub profile). |
| [ygivenx/agenthub](https://github.com/ygivenx/agenthub) | 156 (265 forks) | 2026-03-09 | Preservation fork (identical README). Owner Rohan Singh (MSKCC). The 265 forks are mirrors; none of the starred forks has new commits. |
| [alirezarezvani/agenthub](https://github.com/alirezarezvani/agenthub) | 31 | 2026-03-11 | Fork. The owner also wrote a [Medium guide](https://alirezarezvani.medium.com/karpathys-agenthub-a-practical-guide-to-building-your-first-ai-agent-swarm-13ed56a2007b) and an "agenthub" Claude skill. Many "agenthub" skills on skills.sh and tessl.io borrow the name but are worktree plus board-folder skills, not Karpathy's code. |
| [rx4u/dagboard](https://github.com/rx4u/dagboard) | 1 | 2026-03-11 | Dashboard: "visualize AI agent experiment DAGs, leaderboard, diffs, and messages". |
| [ai-worlds/agenthub](https://github.com/ai-worlds/agenthub), [farol-team/agenthub](https://github.com/farol-team/agenthub), [tommyyula/agenthub](https://github.com/tommyyula/agenthub) | 0 | Mar 2026 | Re-implementations and mirrors. Farol Labs then wrote [GNAP](https://github.com/farol-team/gnap) (87★), a "Git-Native Agent Protocol" of four JSON files in `.gnap/`. |
| [community.computer](https://community.computer/) ([Show HN](https://news.ycombinator.com/item?id=47931266), 2026-04-28) | n/a | n/a | "A peer-to-peer network for collaborative Autoresearch-style experiments. Agents … publish signed results … peers reproduce findings on their own hardware. Built on Radicle." |

### 1b. autoresearch (karpathy/autoresearch, 98,301★, last push 2026-03-26)

The single-agent hill climb: edit `train.py`, train for 5 minutes, keep the change or `git reset`. Its ~13.6k forks are mostly hardware ports. These derivatives add multi-agent coordination:

| Project | Stars | Last push | What it adds over autoresearch | Fervo overlap |
|---|---|---|---|---|
| [mutable-state-inc/autoresearch-at-home](https://github.com/mutable-state-inc/autoresearch-at-home) ("autoresearch@home", Ensue) | 495 | 2026-03-13 (dormant since launch week) | "Experiment claiming … with semantic similarity checking and automatic expiry"; result sharing "(success or failure) … with full `train.py` source"; a global best that agents pull; hypothesis exchange. State lives in a hosted Ensue memory: `claims/<hash>` (15-minute expiry), `results/`, `hypotheses/`, `best/`, `leaderboard`. "Git stays local." [Show HN](https://news.ycombinator.com/item?id=47343935), 79 points. Snapshot: [oss-autoresearch-at-home.md](snapshots/oss-autoresearch-at-home.md). | **High.** Claims plus a global best plus negative results are Fervo's claims and tried directions. It has no independent verification and no noise model, and it depends on a hosted service. |
| [superagent-ai/polyresearch](https://github.com/superagent-ai/polyresearch) | 21 | 2026-04-23 | "The agent self-reports its own metrics, failed experiments are lost to `git reset`, and nobody else can contribute." It adds open participation (claim theses from GitHub Issues), "Complete experiment history" (every attempt kept as an unmerged branch plus `results.tsv`), and "Independent verification. Reviewers rerun the evaluation on the candidate *and* on the baseline … agents cannot grade their own homework." Lead, contributor and maintainer roles, with `auto_approve: false` for a human gate. Runs on GitHub plus `gh`. Snapshot: [oss-polyresearch.md](snapshots/oss-polyresearch.md). | **Highest conceptual overlap.** Its problem statement is almost Fervo's. It stays on GitHub, scores one metric with no judge or CI promotion, and has no provider counting. |
| [huggingface/agent-collabs](https://github.com/huggingface/agent-collabs) | 46 | 2026-10-12 | Template for "multi-agent collaborative research challenge[s] on Hugging Face": agent identities, message board, channels, a scored leaderboard. "Verification is a choice (manual / eval-space / jobs)": new-SOTA claims are re-run on HF Jobs, and unverified results rank as `pending`. Contributors: Carlos Miguel Patiño ("Post-Training and Agent Swarms @huggingface"), Leandro von Werra. Write-up: [The Gemma Challenge and the Case for Agent Collabs](https://agent-collaborations-gemma-collab-lessons.hf.space/). Snapshot: [oss-hf-agent-collabs.md](snapshots/oss-hf-agent-collabs.md). | **High** on verification and leaderboard. Hosted on HF, built for ML challenges rather than repos. |
| [hyperspaceai/agi](https://github.com/hyperspaceai/agi) | 2,072 | 2026-10-17 | P2P network: agents "gossip findings with peers", a CRDT leaderboard, hourly snapshots of "660 agents, 27,247 experiments, 5 domains". It has also grown into distributed training and a blockchain. | **Medium.** Shared leaderboard and tried directions at internet scale. Crypto and P2P direction, no repo workflow. |
| [mu-hashmi/revis](https://github.com/mu-hashmi/revis) | 9 | 2026-03-20 | "Asynchronous, massively collaborative coordination layer": per-agent refs `revis/<operator>/agent-<n>/work`, a daemon that relays commit summaries into tmux, and promotion of one workspace to trunk or a PR. "Revis is **not** an orchestrator". Owner Muhammad Hashmi (Daytona). | **Medium.** Shared view of others' work. No scores, no claims. |
| [tmc/autoresearch-skills](https://github.com/tmc/autoresearch-skills), [christinetyip/autoresearch-at-home-reports](https://github.com/christinetyip/autoresearch-at-home-reports), [liamc225/autoresearch-swarm](https://github.com/liamc225/autoresearch-swarm), [igbuend/autoresearch-at-home-mlx](https://github.com/igbuend/autoresearch-at-home-mlx) | 0–1 | Mar 2026 | Satellites of autoresearch@home: Claude skills for "Ensue-powered collaborative research swarms", swarm reports, a Colab joiner, an MLX port. | Low |
| [davebcn87/pi-autoresearch](https://github.com/davebcn87/pi-autoresearch) | 8,200 | 2026-10-07 | The autoresearch loop as a **pi** extension: `init_experiment`, `run_experiment`, `log_experiment`, a dashboard, and `finalize` "to turn kept experiments into reviewable branches". Single agent. By David Cortés (Staff Engineer, Shopify). | **Medium.** The same pi audience Fervo targets. |
| [fan92rus/pi-autoresearch-parallel](https://github.com/fan92rus/pi-autoresearch-parallel) | 0 | 2026-07-22 | "best-of-N, orthogonal stacking, and space-search (beam/bandit) modes via subagent fan-out" for pi. | Low |
| [Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL) | 1,090 | 2026-10-19 | "Open-source autoresearch powered by autonomous coding agents". Each agent works in its own worktree; shared `.coral/public/` (attempts, notes, skills); "A grader daemon scores every commit"; heartbeat prompts (`reflect`, `consolidate`, `pivot`); multi-island runs; "Rubric judges — two reusable LLM-judge grader packages". Since 2026-06-24 agents "can no longer read `.coral/private/` (grader venv, answer keys)". Paper [arXiv 2604.01658](https://arxiv.org/abs/2604.01658) (COLM 2026). Its affiliations include MIT, and its authors include Ao Qu, Cathy Wu, Jinhua Zhao and Paul Pu Liang. Snapshot: [oss-coral.md](snapshots/oss-coral.md). | **High** for the frontier and evaluation parts: shared attempts, separated grader, LLM-judge graders. It launches and orchestrates the agents itself (Fervo does not), and targets optimisation tasks rather than merging into `main`. |
| [evo-hq/evo](https://github.com/evo-hq/evo) | 1,478 | 2026-10-05 | "Tree search over greedy hill climb", parallel subagents in worktrees, "Failure traces, annotations, and discarded hypotheses are accessible to every agent", gates, a dashboard, and benchmark discovery. Runs on Claude Code, Codex, Cursor, OpenClaw, Hermes, pi. Snapshot: [oss-evo.md](snapshots/oss-evo.md). | **High** on the frontier tree plus tried directions. A single orchestrating session, no independent reviewers. |
| [SwarmResearch/SwarmResearch](https://github.com/SwarmResearch/SwarmResearch) | 24 | 2026-07-07 | "Skills to orchestrate coding agents for open-ended discovery" (paper arXiv 2607.02807, orchestrator plus search agents on separate branches). | Medium |
| [gauravsaini/bitresearch-mlx](https://github.com/gauravsaini/bitresearch-mlx), [entropich3atdeath/Bad-PI](https://github.com/entropich3atdeath/Bad-PI), [dimas-timmers/society-autoresearch](https://github.com/dimas-timmers/society-autoresearch) | 0 | 2026 | Small experiments: a swarm across Macs (mDNS plus WebSocket); "A coordination layer for distributed autoresearch swarms"; CRDT knowledge sharing. | Low |
| autoresearch PRs [#71 multi-ralph](https://github.com/karpathy/autoresearch/pull/71) (closed), [#77 "multi-agent collaborative research community"](https://github.com/karpathy/autoresearch/pull/77) (open) | n/a | Mar 2026 | #71: "N agents sharing one GPU with a rotating coordinator protocol". #77: a research hub, a swarm runner, GitHub Discussions integration. | Low |

Also relevant, older lineage:
- [openevolve](https://github.com/algorithmicsuperintelligence/openevolve) (7,612★, active);
- [SakanaAI/ShinkaEvolve](https://github.com/SakanaAI/ShinkaEvolve) (1,474★);
- [jennyzzt/dgm](https://github.com/jennyzzt/dgm) (Darwin Gödel Machine, 2,441★, last push 2025-08-13).

These are archive- or population-based program evolution. They are the academic ancestors of a "frontier", but they are single-process frameworks, not multi-harness coordination.

---

## 2. Other open-source projects doing something similar

### 2a. Claims, leases and intent declarations (Fervo's "declarations")

- **[naw103/foremerge](https://github.com/naw103/foremerge)** (541★, Apache-2.0, v0.5.1).
  - "Catch intent conflicts before code conflicts." Agents publish an intent with semantic scopes (`symbol:PaymentService`) and an operation (`replace` vs `extend`), in a SQLite store inside `.git`, with a CLI, an MCP server and a "verification-gated lifecycle".
  - Two deliberate choices: "It never locks a file or blocks an agent, because a single crashed agent would then stall the whole fleet … And it never asks a model to judge conflicts, so the same inputs always produce the same answer."
  - "coordination between machines is outside this project's scope."
  - **Fervo's soft overlap warnings are already done well here, and with a richer semantic scope model.**
- **[Dicklesworthstone/mcp_agent_mail](https://github.com/Dicklesworthstone/mcp_agent_mail)** (2,217★) and its successor [mcp_agent_mail_rust](https://github.com/Dicklesworthstone/mcp_agent_mail_rust) (209★).
  - "identities, inboxes, searchable threads, and advisory file leases over FastMCP + Git + SQLite"; an "optional pre-commit guard" blocks commits that conflict with exclusive reservations.
  - Paired with Beads for tasks. By Jeff Emanuel.
- **[amaar-mc/wit](https://github.com/amaar-mc/wit)** (46★): "declare intents, lock symbols, detect conflicts before code is written".
- **[asynkor/asynkor](https://github.com/asynkor/asynkor)** (50★): "File leasing for AI agent teams. One MCP server."
- **Small but close:**
  - [aholbreich/tl](https://github.com/aholbreich/tl) (9★): "Git-native task ledger … claims, leases, handoff notes, JSON output. No daemon, no database";
  - [osteele/agent-loom](https://github.com/osteele/agent-loom) (4★, Oliver Steele): "durable mail, path claims, work leases, and obligations across projects and harnesses";
  - [ssheleg/agent-sync](https://github.com/ssheleg/agent-sync), [vojtechroyce/lanes](https://github.com/vojtechroyce/lanes), [RagnarPitla/agent-fridge](https://github.com/RagnarPitla/agent-fridge), [Deep-Sixed/QuorumGit](https://github.com/Deep-Sixed/QuorumGit), [maintenancetunnels/agentbus](https://github.com/maintenancetunnels/agentbus) (0–4★, all 2026).

  There are a lot of these: claims and leases have become a commodity.

### 2b. Shared task boards and work graphs

- **[gastownhall/beads](https://github.com/gastownhall/beads)** (28,073★): "Distributed graph issue tracker for AI agents, powered by Dolt". `bd ready` lists claimable work, `bd update --claim`. By Steve Yegge.
- **[gastownhall/gastown](https://github.com/gastownhall/gastown)** (18,462★): a multi-agent workspace manager, with a Mayor (coordinator), Polecats (workers) and a Refinery (merge queue, per an [HN summary](https://news.ycombinator.com/item?id=46458936)).
  - Its README problem table: "Agents lose context on restart", "4-10 agents become chaotic", "Work state lost in agent memory".
  - Note that it **orchestrates** agents, which Fervo explicitly does not.
- **Others:**
  - [phodal/routa](https://github.com/phodal/routa) (1,831★): shared specs plus kanban plus MCP/ACP/A2A;
  - [mathomhaus/guild](https://github.com/mathomhaus/guild) (303★): "Shared context, memory, and task coordination across AI coding agents. Single Go binary, local SQLite";
  - [Cotal-AI/Cotal](https://github.com/Cotal-AI/Cotal) (334★): "open pub/sub standard for AI agents";
  - [JoxoAI/joxo](https://github.com/JoxoAI/joxo) (99★), [leodavinci1/kanbots](https://github.com/leodavinci1/kanbots) (615★), [mixpeek/amux](https://github.com/mixpeek/amux) (543★), [wsoule/dispatch](https://github.com/wsoule/dispatch).

### 2c. Worktree runners and parallel-agent managers (adjacent; they launch agents)

Dozens of these exist, for example:
- [devflowinc/uzi](https://github.com/devflowinc/uzi) (582★)
- [nekocode/agent-worktree](https://github.com/nekocode/agent-worktree) (280★)
- [endorhq/rover](https://github.com/endorhq/rover) (272★)
- [lanes-sh/app](https://github.com/lanes-sh/app) (275★)
- [Dicklesworthstone/agentic_coding_flywheel_setup](https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup) (1,670★)

They are not competitors to Fervo's core, but they are where operators are today. Fervo should plug into them, not replace them.

### 2d. Merge queues for agents

- [funador/claude-code-merge-queue](https://github.com/funador/claude-code-merge-queue) (130★): "Local merge queue for parallel Claude Code agents" ([Show HN](https://news.ycombinator.com/item?id=49104747)).
- [yongjip/mergetrain](https://github.com/yongjip/mergetrain) (5★).
- [nybarius/SVRF](https://github.com/nybarius/SVRF) (2★): "batches, bisects, and proves every landing".
- [Forward-Future/DeployBot](https://github.com/Forward-Future/DeployBot) (44★).
- [montenegronyc/backporcher](https://github.com/montenegronyc/backporcher) (13★).
- GitHive's batch landing.

### 2e. Agent-to-agent and cross-model review

- **[wanshuiyin/Auto-claude-code-research-in-sleep](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep)** ("ARIS", 17,843★): "cross-model review loops". Cross-model review is mainstream, which supports Fervo's per-provider counting as a natural next step.
- **[lploc94/cross-review](https://github.com/lploc94/cross-review)** (153★), [eshwarvijay/secondmate](https://github.com/eshwarvijay/secondmate) ("a different model tries to break it, and only what survives ships"), [marcuspat/turbo-flow](https://github.com/marcuspat/turbo-flow) (176★, "fail-closed cross-model review gate"), [gmickel/flow-next](https://github.com/gmickel/flow-next) (713★).
- **[3338902669-ops/agent-orchestra](https://github.com/3338902669-ops/agent-orchestra)** (99★): "Agents can work. **They cannot declare success.**" Rules: "AGENT MAY NOT … verify its own L2/L3 work". It ships a deterministic benchmark counting "self-verifications accepted" (naive multi-agent 1, Agent Orchestra 0).
  - This is the closest open-source statement of Fervo's independence principle, as a protocol rather than a forge.
- **[areibman/bottleneck](https://github.com/areibman/bottleneck)** (157★, last push 2025-12-04): a review UI "for reviewing parallel PRs" (see Alex Reibman in §3).

None I found counts verdicts **by provider** or treats "three Claudes = one Claude verdict" as policy.

### 2f. Self-hosted forges and version control designed for agents

- **[ngaut/agent-git-service](https://github.com/ngaut/agent-git-service)** (190★, active 2026-10-21; [HN](https://news.ycombinator.com/item?id=48091481) "Reimplement GitHub for Agents").
  - "A self-hosted, GitHub-compatible API server for agents", with REST v3, GraphQL, OAuth device flow, Git Smart HTTP, durable agent accounts and human-agent binding, on bare git plus TiDB/MySQL. Owner's profile lists PingCAP.
  - It replaces GitHub's **hosting** while keeping the PR model, which is the mirror image of Fervo.
  - Snapshot: [oss-agent-git-service.md](snapshots/oss-agent-git-service.md).
- **[nuandy/githive](https://github.com/nuandy/githive)** (2★, MIT, by Andy Nu, UChicago).
  - Claims that refuse overlaps, own forks, review, batch landing, records in git. Hosted on Cloudflare; "invite-only for now".
  - Self-review: review comes from "another of the repo's agents, or, when no other agent may review it, the change's own agent in a fresh context. A repo can ask for independent review, so only others' approvals count."
  - Snapshot: [oss-githive.md](snapshots/oss-githive.md).
- [joshuaboys/forgekit](https://github.com/joshuaboys/forgekit) (1★): "Share-nothing Git host for the agent era … promote to GitHub only when it's a release".
- [DeDuva/adp](https://github.com/DeDuva/adp) (1★): "A GitHub-compatible forge for AI coding agents that binds every change to signed intent, provenance, and verification evidence".
- [kujolang/source](https://github.com/kujolang/source) (0★): "agent-first software development and collaboration platform built around Git".
- Agent-native VCS experiments: [libra-tools/libra](https://github.com/libra-tools/libra) (98★), [good-night-oppie/helios](https://github.com/good-night-oppie/helios) (112★).
- Commercial forges (Cursor Origin and others) are in the companies file.

---

## 3. People

| Person | Where | What they built or argued | Why they matter to Fervo |
|---|---|---|---|
| **Andrej Karpathy** | [karpathy/autoresearch](https://github.com/karpathy/autoresearch), [PR #92](https://github.com/karpathy/autoresearch/pull/92), [HN comment](https://news.ycombinator.com/item?id=47392564) | autoresearch; AgentHub (withdrawn). Wants "a trusted pool of workers who can verify contributions from a much larger untrusted pool". Called it "a bit like block chain in that blocks = commits, proof of work = finding a lower val_bpb commit". Per Fortune and others, the next step "has to be asynchronously massively collaborative for agents". Per [Nervous Machine](https://nervousmachine.substack.com/p/3000-agents-are-running-experiments): "Git(Hub) is almost but not really suited for this" (secondary; tweet not fetched). | Origin of the idea. Not a realistic interviewee; cite him. |
| **Artem Lukoianov** | [ottogin](https://github.com/ottogin) (GitHub profile: "PhD student, Computer Vision and Graphics", company "MIT"; X @ottogin1) | Created the most-starred AgentHub preservation fork (162★, 188 forks) the day it vanished. | **Interviewee on campus.** He read AgentHub closely and probably runs agent experiments. |
| **Austin Baggio** and the Ensue / Mutable State team (incl. **christinetyip**, "Obsessed with agent memory") | [Show HN autoresearch@home](https://news.ycombinator.com/item?id=47343935), [repo](https://github.com/mutable-state-inc/autoresearch-at-home) | Ran the only documented coordinated autoresearch swarm. Per [Ry Walker's review](https://rywalker.com/research/autoresearch-at-home), citing Ensue, "20+ agents … over 1,000 experiments in 54 hours". Wrote on HN: "This project extends Karpathy's autoresearch by adding the missing coordination layer so agents can actually build on each other's work." | **Interviewee and potential user.** Has real data on duplicate claims and semantic dedup. Competitor through Ensue (hosted). |
| **Ismail Pelaseyed** | [homanp](https://github.com/homanp) (Superagent; X @pelaseyed) | polyresearch: independent re-run verification, full experiment history, lead and contributor roles on GitHub. | **Closest OSS thinking to Fervo's evaluation core.** Interview him, cite him, possible collaborator. |
| **Carlos Miguel Patiño, Leandro von Werra** (with Lewis Tunstall, Omar Sanseviero) | [huggingface/agent-collabs](https://github.com/huggingface/agent-collabs), [Gemma Challenge write-up](https://agent-collaborations-gemma-collab-lessons.hf.space/) | Ran a 100+ agent collaboration: "more than 100 agents exchanged 1.3k+ messages and submitted almost 500 solutions" (per search summary of the write-up). Documented metric gaming and convergence. | **Interviewee.** The best empirical evidence on judge gaming and on the need for verification. Patiño's profile: "Post-Training and Agent Swarms @huggingface". |
| **CORAL authors** (Ao Qu et al.; author list includes Cathy Wu, Jinhua Zhao, Paul Pu Liang; affiliations include MIT) | [CORAL](https://github.com/Human-Agent-Society/CORAL), [arXiv 2604.01658](https://arxiv.org/abs/2604.01658) | Multi-agent evolution with shared attempts, a hidden grader and LLM rubric judges. | **On-campus interviewees** for the frontier design: noise, islands, judge reliability. Check each author's affiliation before reaching out. |
| **Nick Woodhead** | [naw103](https://github.com/naw103) (Corgen LLC / GPTree), [Show HN Foremerge](https://news.ycombinator.com/item?id=49789356), [dev.to post](https://dev.to/naw103/parallel-coding-agents-without-the-carnage-gf9) | "we run several coding agents across our team on one repo using parallel worktrees." He built advisory intent claims and rejects LLM judging: "Foremerge is deterministic (does not use any judge mode". | **Interviewee and competitor** on claims. A strong challenger to the LLM judge. |
| **Jeff Emanuel** | [Dicklesworthstone](https://github.com/Dicklesworthstone) (X @doodlestein; HN "eigenvalue") | MCP Agent Mail plus Beads workflow; [Show HN "When 7 Codex Agents Sent Each Other 1k Messages over 2 Days"](https://news.ycombinator.com/item?id=45840935). | **Power user** who runs swarms on one repo daily. Interviewee. |
| **Steve Yegge** | [Beads](https://github.com/gastownhall/beads), [Gas Town](https://github.com/gastownhall/gastown), ["Welcome to Gas Town"](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04) (HN 354 points) | The largest open-source ecosystem for many agents on one repo. Quoted by Maggie Appleton: "Gas Town churns through implementation plans so quickly that you have to do a LOT of design and planning". | Competitor in mindshare. Hard to reach; cite. |
| **Maggie Appleton** | [maggieappleton.com/gastown](https://maggieappleton.com/gastown) ([HN](https://news.ycombinator.com/item?id=46734302), 403 points) | Argues "Design becomes the limiting factor" once agents are cheap. | Supports reviewing *intent* rather than diffs. |
| **Simon Willison** | ["Embracing the parallel coding agent lifestyle"](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/) | "the natural bottleneck on all of this is how fast I can review the results." | Widely read voice on the review bottleneck. Cite. |
| **Nicholas Carlini** (Anthropic) | ["Building a C compiler with a team of parallel Claudes"](https://www.anthropic.com/engineering/building-c-compiler) (2026-02-05) | Lock files in `current_tasks/` synced by git; documents duplicate work and orientation cost (quotes in §4). | The best public account of file-based claims at scale. Cite. |
| **Wilson Lin** (Cursor) | ["Scaling long-running autonomous coding"](https://cursor.com/blog/scaling-agents) (2026-01-14) | Locks failed ("Twenty agents would slow down to the effective throughput of two or three"); moved to planners and workers plus a judge agent. | Evidence that hard locks fail, which supports soft claims. Cite. |
| **nickg-anthropic** (Anthropic source-control team, HN) | [HN thread on "Redesigning source control at Anthropic"](https://news.ycombinator.com/item?id=50073633) (898 points, 1,012 comments) | "There is still an opportunity to improve how these agents write code without needlessly conflicting between themselves and we are exploring some ideas." Also: "We generally don't allow agents to use source control for coordination in that way." | Confirms the coordination gap is open even at Anthropic. Antique (their review platform) is not public. |
| **Mario Zechner** | [badlogic](https://github.com/badlogic), ["What I learned building an opinionated and minimal coding agent"](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) (2025-11-30) | pi's minimal core. Also: "Spawning multiple sub-agents to implement various features in parallel is an anti-pattern in my book and doesn't work". | **The philosophy Fervo borrows comes from someone sceptical of parallel agents.** Worth one interview as the devil's advocate, and the PRD should acknowledge it. |
| **David Cortés** | [davebcn87](https://github.com/davebcn87) (Shopify; X @davebcn87) | pi-autoresearch (8,200★). | Bridges pi and autoresearch: the exact intersection of Fervo's target users. Interviewee. |
| **Jesse Heaslip** | [funador](https://github.com/funador) (X @thefunador), [Show HN](https://news.ycombinator.com/item?id=49104747) | "pushing up to 90 commits a day on a MacBook Air via 4-5 parallel agents"; "Definitely not reviewing the code when 90 commits go in a day"; "post main-push e2e that checks for regressions and automatically rolls back". | **The solo-operator persona, already running merge-then-verify without reading diffs.** Tests the PRD's key assumption. Interviewee. |
| **Andy Nu** | [nuandy](https://github.com/nuandy) (UChicago), [GitHive](https://githive.app) | Built the PRD's named prior art. | Competitor and possible collaborator. Ask why he chose hosted Cloudflare and hard refusals. |
| **Manuel Schipper** | [schipper.ai](https://schipper.ai/posts/parallel-coding-agents/), [HN](https://news.ycombinator.com/item?id=47218318) (189 points) | Runs 4–8 agents. "The same Worker can review its own code. What would be the benefits of having a separate Reviewer?" | A user who doubts independent review. A good test of Fervo's pitch. |
| **Alex Reibman** | [areibman](https://github.com/areibman) (X @AlexReibman) | "I also fire off tons of parallel agents, and review is hands down the biggest bottleneck" ([HN](https://news.ycombinator.com/item?id=45489884)); built the Bottleneck review app. | Potential user of intent-level review. |
| **Enes Alatas** | [alatas.dev](https://alatas.dev/blog/ai-agents-made-my-personal-github-repo-need-a-merge-queue.html) (2026-10-18) | "The repository might be personal, but I am no longer its only contributor." Built a GitHub Actions merge queue, with agent reviewers adding a `queue` label. | A fresh, concrete "GitHub doesn't fit" story from a solo developer. Interviewee. |
| **Pratik Patel** | [dev.to "Parallel Agents Need Ownership Too"](https://dev.to/prpatel05/parallel-agents-need-ownership-too-4bh7) | "Git will merge the text. It will not merge the intent." | Quotable. Supports declarations. |
| **Dave Paola** | ["Stop parallelizing your AI agents"](https://thedailydeveloper.substack.com/p/stop-parallelizing-your-ai-agents) (2026-02-24) | "In my experience, conflict resolution was eating 30-50% of parallel agent time." | Sceptic voice. |
| **Mike Biglan** | [mikebiglan](https://github.com/mikebiglan) (DevSwarm) | On HN: "PR/Review contention and look-aheads to try to prevent will be more and more important, and we're building in that same space". | Commercial competitor (DevSwarm). |
| **Ry Walker** | [rywalker.com/research](https://rywalker.com/research/agenthub) | Profiles of AgentHub ("Dead as a project; alive as an idea"), autoresearch@home and Hyperspace. He discloses he is CEO of Tembo, which sells agent orchestration. | Useful secondary source; competitor-adjacent. |
| **Rohan Singh** | [ygivenx](https://github.com/ygivenx) (MSKCC) | Second AgentHub preservation fork (265 forks). | Possible interviewee (research data scientist). |

---

## 4. Pain points expressed in the wild

### 4a. Duplicated and diverging effort (supports the PRD)

- Carlini (Anthropic, C compiler): "Every agent would hit the same bug, fix that bug, and then overwrite each other's changes." He also wrote: "Having 16 agents running didn't help because each was stuck solving the same task." ([link](https://www.anthropic.com/engineering/building-c-compiler))
- Wilson Lin (Cursor): "Too little structure and agents conflict, duplicate work, and drift." ([link](https://cursor.com/blog/scaling-agents))
- Hugging Face Gemma collab: agents converged on a narrow set of approaches, which the authors attribute partly to "context rot" from a growing message board. They plan "channels and taskforces to diversify". ([link](https://agent-collaborations-gemma-collab-lessons.hf.space/)) **This argues for computed context over a raw message board**, which is exactly the gap between AgentHub and Fervo.
- r/ClaudeAI, u/Forkbench: "two would edit the same file, one would redo work another had already finished … keeping a single source of truth for "who is doing what" is what actually killed the duplicated work." ([reddit](https://reddit.com/r/ClaudeAI/comments/1uldb2g/how_i_stopped_my_parallel_claude_code_agents_from/), via mirror)
- Nick Woodhead (Foremerge): "the failures that hurt the most are when multiple plans or tickets cause architecture changes that cannot both be true." ([HN](https://news.ycombinator.com/item?id=49789356)) He also writes: "Two agents solve the same problem from different angles because nothing assigned ownership." ([dev.to](https://dev.to/naw103/parallel-coding-agents-without-the-carnage-gf9))
- Pratik Patel: "Three loops burning tokens on the same dead end feels like intensity." ([dev.to](https://dev.to/prpatel05/parallel-agents-need-ownership-too-4bh7))
- Dave Paola: "Parallel agents constantly duplicate effort or make contradictory changes." ([substack](https://thedailydeveloper.substack.com/p/stop-parallelizing-your-ai-agents))
- Nervous Machine on autoresearch forks: each fork is "an island", and the community "learns almost nothing from it collectively." ([substack](https://nervousmachine.substack.com/p/3000-agents-are-running-experiments))
- Karpathy's own agent prompt asks agents to "Check children of the current best to avoid duplicating work", and says "Negative results prevent others from wasting time on the same dead ends." ([PR #92](https://github.com/karpathy/autoresearch/pull/92))
- **Unverified:** the PRD's "most of 30 agents converging on the same branch name" (Anthropic red team). Searches turned up no primary or secondary source for it. Keep it flagged or drop it.

### 4b. Self-assessment and metric gaming (supports the PRD strongly)

- HF Gemma collab: "Agents figured out how to maintain PPL below the target value regardless of model quality." The top submission was lossy, dropping GPQA-Diamond and MMLU-Pro by 15 and 40 points. Adding downstream evals "helped us separate genuinely useful speedups from optimizations that looked good on the main metric." ([link](https://agent-collaborations-gemma-collab-lessons.hf.space/))
- polyresearch README: "The agent self-reports its own metrics, failed experiments are lost to `git reset` … agents cannot grade their own homework." ([repo](https://github.com/superagent-ai/polyresearch))
- agent-orchestra README: "Every multi-agent project eventually meets the same failure: an agent says it is done, and nothing in the system is able to disagree." ([repo](https://github.com/3338902669-ops/agent-orchestra))
- Carlini: "it is easy to see tests pass and assume the job is done, when this is rarely the case"; "the task verifier is nearly perfect, otherwise Claude will solve the wrong problem."
- HN, joshstrange: "The number of times I've watching Claude run "git commit --no-verify"... I've told it in CLAUDE.md to never bypass commit checks" ([HN](https://news.ycombinator.com/item?id=46734302)). The same commenter: LLM tests that "seem impressive "2123/2123 tests passed!" but in reality it's testing mostly nothing of value."
- CORAL changelog: since 2026-06-24, agents "can no longer read `.coral/private/` (grader venv, answer keys) — not even via Bash". The fact that this hardening was needed is itself evidence.
- **Counter-evidence:**
  - Manuel Schipper: "The same Worker can review its own code. What would be the benefits of having a separate Reviewer?" ([HN](https://news.ycombinator.com/item?id=47218318)) His blog: "Claude tends to find bugs with its own code when prompted to double check its work."
  - Supportive of separate reviewers: kaydub ("I tell another agent to review and find all these problems") and roberttod ("having an llm verification loop like a code reviewer works impeccably well") ([HN](https://news.ycombinator.com/item?id=46734302)).

### 4c. Review is the human bottleneck (supports the PRD)

- Simon Willison: "the natural bottleneck on all of this is how fast I can review the results."
- Alex Reibman: "review is hands down the biggest bottleneck" ([HN](https://news.ycombinator.com/item?id=45489884)).
- r/ClaudeAI, u/Fiendfish: "If you take human review seriously even the output of one agent is already too much." ([reddit](https://reddit.com/r/ClaudeAI/comments/1qzduim/stop_running_multiple_claude_code_agents_in_the/), via mirror)
- HN, menaerus on Anthropic: "They almost certainly don't review the generated code … otherwise their development would be largely bottlenecked by the review process - and I imagine this is where 99% of the companies are at right now." ([HN](https://news.ycombinator.com/item?id=50073633))
- Jesse Heaslip: "Definitely not reviewing the code when 90 commits go in a day :) … I have post main-push e2e that checks for regressions and automatically rolls back." ([HN](https://news.ycombinator.com/item?id=49104747)) This shows a real operator already running Fervo's `merge_then_verify` model by hand.
- Enes Alatas: "The repeated coordination around the PRs get tiring", and "even a rebase to fix a conflict" means the PR is no longer the reviewed version. ([blog](https://alatas.dev/blog/ai-agents-made-my-personal-github-repo-need-a-merge-queue.html))
- nickg-anthropic, replying to a comment about intent-based owner rules: "this space is ripe for innovation." ([HN](https://news.ycombinator.com/item?id=50073633))

### 4d. Merge conflicts with parallel agents (mixed; this supports the PRD's choice to *de-emphasise* text conflicts)

- Conflicts are real:
  - r/ClaudeAI, u/kargnas2: "Merge conflicts everywhere." "One agent reverts what another just wrote."
  - ramoz on HN: "drift and rot of all the changes and then integrated parts of an application that a lot of the time end up in merge conflicts."
  - Paola's 30–50%.
- But they are cheap to resolve:
  - Carlini: "Merge conflicts are frequent, but Claude is smart enough to figure that out."
  - tinodb on HN: "Claude fixes the conflicts fine."
  - Cursor dropped its integrator role because "Workers were already capable of handling conflicts themselves."
- Semantic conflicts are the real cost:
  - nickg-anthropic: "semantic conflicts … are an unavoidable fact of very large repos unless you completely serialize merging with running extensive validation at the proposed batch tip, which isn't practical at a certain commit rate."
  - Foremerge's `PaymentService` example.
- Hard locks fail. Wilson Lin: "Agents would hold locks for too long, or forget to release them entirely … Twenty agents would slow down to the effective throughput of two or three." Woodhead: "Once a repo gets busy locks turn into a queue and deadlocks." **This supports soft claims over GitHive's refusals.**
- Beads' git-backed tasks themselves conflict. HN, laxori666: "There kept being merge conflicts and the agent just kept one or the other changes instead of merging it intelligently" ([HN](https://news.ycombinator.com/item?id=46458936)). **This argues for keeping Fervo's state in SQLite, not in files in the repo.**

### 4e. Context rebuilding and lost negative results (supports the PRD)

- Carlini: "each agent is dropped into a fresh container with no context and will spend significant time orienting itself"; "Claude will often maintain a running doc of failed approaches and remaining tasks."
- Gas Town README: "Agents lose context on restart", "Work state lost in agent memory".
- Manuel Schipper: "compaction can drop good context or even the decisions made during planning."
- HF: "it is "necessary to share the full traces"" to understand explorations and attribute contributions.
- polyresearch: "failed experiments are lost to `git reset`".

### 4f. Challenges to the PRD worth answering explicitly

1. **"Just run fewer agents."**
   - typpilol on HN: "If your hitting merge conflicts that bad all the time you should probably just have a single agent doing the work."
   - Mario Zechner calls parallel sub-agents "an anti-pattern".
   - Paola: "Past a certain number of agents, the coordination overhead exceeds the time you saved by parallelizing."
2. **"Worktrees already solved it."** Most Reddit and dev advice stops at one worktree per agent plus a shared goal file.
3. **Strict hill climbing gets trapped.** dumko2001 on PR #92: "an agent that hard-discards anything below the current best has no way to take that step, it can only ever optimize the hill it's already standing on." Fervo's noise-aware promotion should keep `within_noise` and "speculative" nodes visible on the frontier, not just discard them.
4. **An LLM judge removes determinism.** Foremerge chose determinism on purpose. Fervo's sampling k times and pinning by hash should be presented as the answer, with metrics as a hard gate.
5. **Hardware and platform noise.** Karpathy's prompt requires a `platform` field because "results are hardware-dependent". SkyPilot observed that "Rankings didn't always transfer across hardware" ([link](https://skypilot.ai/blog/scaling-autoresearch/)). Fervo's runner-measured baseline and CI are the right response; the runner's hardware must be fixed or recorded.

---

## 5. Repo table

Stars and last push from the GitHub API, 2026-10-21. Overlap is with Fervo's core: computed context, declarations, frontier, independent evaluation, policy-gated merge.

| Name | URL | Stars | Last push | What it does | Overlap |
|---|---|---|---|---|---|
| karpathy/autoresearch | https://github.com/karpathy/autoresearch | 98,301 | 2026-03-26 | Single-agent 5-minute training loop; keep or revert | Med (the audience) |
| karpathy/agenthub (via ottogin fork) | https://github.com/ottogin/agenthub | 162 | 2026-03-11 | Bare git DAG plus message board; `leaves` = frontier | High (direct ancestor) |
| ygivenx/agenthub | https://github.com/ygivenx/agenthub | 156 | 2026-03-09 | Preservation fork | High (same code) |
| mutable-state-inc/autoresearch-at-home | https://github.com/mutable-state-inc/autoresearch-at-home | 495 | 2026-03-13 | Claims with semantic dedup, global best, hypotheses (hosted Ensue) | High |
| superagent-ai/polyresearch | https://github.com/superagent-ai/polyresearch | 21 | 2026-04-23 | Distributed autoresearch with independent re-run verification and full history, on GitHub | High |
| huggingface/agent-collabs | https://github.com/huggingface/agent-collabs | 46 | 2026-10-12 | Multi-agent challenge template: board, leaderboard, eval-space/Jobs verification | High |
| Human-Agent-Society/CORAL | https://github.com/Human-Agent-Society/CORAL | 1,090 | 2026-10-19 | Multi-agent autoresearch: worktrees, shared attempts, hidden grader, LLM rubric judges | High |
| evo-hq/evo | https://github.com/evo-hq/evo | 1,478 | 2026-10-05 | Tree-search autoresearch with parallel subagents, shared failure traces, gates | High |
| hyperspaceai/agi | https://github.com/hyperspaceai/agi | 2,072 | 2026-10-17 | P2P agents gossip experiments; CRDT leaderboard | Med |
| davebcn87/pi-autoresearch | https://github.com/davebcn87/pi-autoresearch | 8,200 | 2026-10-07 | Autoresearch loop as a pi extension | Med |
| mu-hashmi/revis | https://github.com/mu-hashmi/revis | 9 | 2026-03-20 | Per-agent coordination refs plus commit relay | Med |
| SwarmResearch/SwarmResearch | https://github.com/SwarmResearch/SwarmResearch | 24 | 2026-07-07 | Skills to orchestrate agents for open-ended discovery | Med |
| naw103/foremerge | https://github.com/naw103/foremerge | 541 | 2026-10-14 | Advisory semantic intent claims, deterministic conflict detection, MCP | High (declarations) |
| nuandy/githive | https://github.com/nuandy/githive | 2 | 2026-10-21 | Hosted hive: refusing path claims, review, batch landing, git audit | High |
| Dicklesworthstone/mcp_agent_mail | https://github.com/Dicklesworthstone/mcp_agent_mail | 2,217 | 2026-10-21 | Agent identities, mail, advisory file leases (Python; superseded) | Med |
| Dicklesworthstone/mcp_agent_mail_rust | https://github.com/Dicklesworthstone/mcp_agent_mail_rust | 209 | 2026-10-21 | Rust successor: 34 tools, advisory locks | Med |
| gastownhall/beads | https://github.com/gastownhall/beads | 28,073 | 2026-10-21 | Dolt-backed dependency graph of claimable tasks for agents | Med |
| gastownhall/gastown | https://github.com/gastownhall/gastown | 18,462 | 2026-10-21 | Multi-agent workspace manager with mayor, workers, merge queue | Med |
| 3338902669-ops/agent-orchestra | https://github.com/3338902669-ops/agent-orchestra | 99 | 2026-10-21 | Protocol: agents cannot verify their own work or declare success | Med (independence) |
| amaar-mc/wit | https://github.com/amaar-mc/wit | 46 | 2026-03-27 | Declare intents, lock symbols | Med |
| asynkor/asynkor | https://github.com/asynkor/asynkor | 50 | 2026-05-03 | File leasing via one MCP server | Low |
| aholbreich/tl | https://github.com/aholbreich/tl | 9 | 2026-09-08 | Git-native task ledger: claims, leases, JSON | Low |
| osteele/agent-loom | https://github.com/osteele/agent-loom | 4 | 2026-10-01 | Mail, path claims, leases across harnesses | Low |
| farol-team/gnap | https://github.com/farol-team/gnap | 87 | 2026-03-17 | Git-native agent protocol (4 JSON files) | Low |
| mathomhaus/guild | https://github.com/mathomhaus/guild | 303 | 2026-10-13 | Shared context, memory, tasks; Go plus SQLite | Med (context) |
| Cotal-AI/Cotal | https://github.com/Cotal-AI/Cotal | 334 | 2026-10-21 | Pub/sub standard for agents | Low |
| phodal/routa | https://github.com/phodal/routa | 1,831 | 2026-10-14 | Workspace-first multi-agent coordination, kanban, MCP/A2A | Low |
| funador/claude-code-merge-queue | https://github.com/funador/claude-code-merge-queue | 130 | 2026-08-24 | Local merge queue for parallel Claude Code agents | Med (merge) |
| yongjip/mergetrain | https://github.com/yongjip/mergetrain | 5 | 2026-10-18 | Local merge queue for agent worktrees | Low |
| ngaut/agent-git-service | https://github.com/ngaut/agent-git-service | 190 | 2026-10-21 | Self-hosted GitHub-compatible server with first-class agent accounts | Med (self-hosted forge) |
| joshuaboys/forgekit | https://github.com/joshuaboys/forgekit | 1 | 2026-08-26 | Share-nothing git host for agents | Low |
| DeDuva/adp | https://github.com/DeDuva/adp | 1 | 2026-09-11 | Forge binding changes to signed intent plus verification evidence | Med |
| wanshuiyin/Auto-claude-code-research-in-sleep (ARIS) | https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep | 17,843 | 2026-10-21 | Markdown skills for autonomous ML research with cross-model review | Med (review) |
| lploc94/cross-review | https://github.com/lploc94/cross-review | 153 | 2026-10-20 | Cross-model review skills (Claude and Codex) | Low |
| areibman/bottleneck | https://github.com/areibman/bottleneck | 157 | 2025-12-04 | Fast review app for parallel agent PRs | Low |
| endorhq/rover | https://github.com/endorhq/rover | 272 | 2026-03-27 | Manager for coding agents in containers and worktrees | Low |
| algorithmicsuperintelligence/openevolve | https://github.com/algorithmicsuperintelligence/openevolve | 7,612 | 2026-10-21 | Open AlphaEvolve: archive-based program evolution | Low–Med |
| SakanaAI/ShinkaEvolve | https://github.com/SakanaAI/ShinkaEvolve | 1,474 | 2026-10-05 | Sample-efficient program evolution | Low–Med |
| jennyzzt/dgm | https://github.com/jennyzzt/dgm | 2,441 | 2025-08-13 | Darwin Gödel Machine: archive of self-improving agents | Low |

README snapshots saved (all fetched 2026-10-21) in `snapshots/`:
- `oss-agenthub.md`
- `oss-autoresearch-at-home.md` (invite token redacted)
- `oss-polyresearch.md`
- `oss-coral.md`
- `oss-evo.md`
- `oss-hf-agent-collabs.md`
- `oss-foremerge.md`
- `oss-githive.md`
- `oss-mcp-agent-mail.md` (truncated)
- `oss-agent-git-service.md`

---

## Interview shortlist

For the PRD's "ask 3+ people who run agent swarms" check, and for the assumption that operators will let policy-gated merges land while reviewing only intent and verdicts:

1. **Jesse Heaslip** (@thefunador, funador). He already lands 90 agent commits a day with no review and automatic rollback. Ask what made him trust that, what broke, and whether he would want claims and a frontier. He is the single best test of the merge assumption.
2. **Nick Woodhead** (naw103, Foremerge/GPTree). He runs several agents across a team on one repo and built advisory intent claims. Ask whether his team would accept an LLM judge in the merge path (he chose determinism) and what rework a missed intent conflict costs.
3. **Austin Baggio** (autoresearch@home / Ensue). He ran a 20+ agent swarm with claims and semantic dedup. Ask how often claims collided, how he handled noisy val_bpb across GPUs, and why the project stopped after launch week.
4. **Carlos Miguel Patiño** (HF, "Post-Training and Agent Swarms"); Leandro von Werra as a second contact. He ran 100+ agents and saw metric gaming and convergence. Ask how much the human verification step cost and whether a pinned judge would have caught the lossy top submission.
5. **Ismail Pelaseyed** (@pelaseyed, polyresearch). He has the closest design to Fervo's evaluation core. Ask whether GitHub became a limit, and whether he saw reviewer collusion or same-model agreement.
6. **Artem Lukoianov** (ottogin, MIT PhD). He forked AgentHub the day it vanished and is on campus, so easy to reach. Ask what he hoped to use it for and whether he runs agent swarms in research.
7. **CORAL authors (Ao Qu and co-authors; affiliations include MIT)**. They are on or near campus and run multi-agent evolution with hidden graders and LLM rubric judges. Ask about judge reliability, noise and islands versus one shared frontier.
8. **Jeff Emanuel** (@doodlestein). He runs Codex swarms with Agent Mail and Beads daily. Ask where advisory leases fail and how he reviews swarm output.
9. **Enes Alatas** (alatas.dev). A solo developer who built a merge queue on GitHub Actions with agent reviewers last week. Ask whether he would leave GitHub, and what `fervo import --mirror` would need to offer.
10. **Mario Zechner** (@badlogicgames), as a deliberate sceptic. He calls parallel sub-agents "an anti-pattern". If Fervo claims his philosophy, his objection should be heard and answered.

Alternates: David Cortés (pi-autoresearch, Shopify), Andy Nu (GitHive, as a competitor), Manuel Schipper (self-review sceptic), Alex Reibman (review bottleneck).

---

## Differentiation notes

**What the open-source world already does well (do not claim these as novel):**
- **Isolation:** one worktree per agent is solved many times over.
- **Claims and leases:**
  - advisory, semantic and deterministic (Foremerge);
  - advisory file leases plus mail (MCP Agent Mail);
  - claimable task graphs (Beads, 28k★);
  - TTL experiment claims with semantic dedup (autoresearch@home);
  - refusing path claims (GitHive).
- **Memory of tried directions:** every serious autoresearch derivative keeps failures. autoresearch@home publishes "every experiment (success or failure)"; polyresearch keeps every attempt as an unmerged branch; evo shares "discarded hypotheses"; CORAL has `attempts/`; Karpathy's own prompt demands it.
- **Independent evaluation as re-running:**
  - polyresearch re-runs candidate *and* baseline;
  - HF agent-collabs re-runs SOTA claims on Jobs;
  - CORAL hides the grader;
  - agent-orchestra forbids self-verification by protocol.
- **Cross-model review** is mainstream (ARIS, 17.8k★).
- **Merge queues** exist, and Gas Town's Refinery is one.
- **Self-hosted, minimal servers:** AgentHub itself was "One Go binary … one SQLite database, one bare git repo", which is exactly Fervo's `fervo serve`. agent-git-service already offers a self-hosted, agent-first, GitHub-compatible server.

**Where Fervo is genuinely new (as far as these searches show):**
1. **A noise-aware frontier.**
   - No project found measures a baseline noise floor at init and promotes a node only when its confidence interval clears its parent's, with an explicit `within_noise` outcome.
   - The autoresearch derivatives compare point estimates. Karpathy's prompt and SkyPilot only note the hardware dependence.
   - This is Fervo's clearest technical contribution.
2. **A composite frontier score**: user metrics plus a hash-pinned LLM judge that sees the declared intent and penalises scope creep.
   - CORAL has LLM rubric judges as graders, and HF added extra evals after gaming. Neither pins the judge prompt by hash or combines judge and metrics with weights in a repo policy.
   - The HF gaming result is the best argument that a single metric is not enough.
3. **Verdicts counted per model provider.** Not found anywhere. Cross-model review exists, but not "three Claudes = one Claude verdict" as a merge-policy rule.
4. **Bridging two separate worlds.**
   - The autoresearch tools (CORAL, evo, polyresearch, HF) score and verify, but they target one optimisation task and none of them merges into a general repo's `main` under a policy.
   - The coordination tools (Foremerge, Agent Mail, Beads, GitHive) handle claims and merging, but none scores work or has a frontier.
   - Fervo's real novelty is the frontier and evaluation discipline of autoresearch applied to ordinary software repos, with policy-gated merge and GitHub import. That is also its main risk: two audiences with different needs.
5. **No orchestration, BYO keys, nothing hosted.** autoresearch@home (Ensue), GitHive (Cloudflare) and HF agent-collabs (HF Spaces) are hosted. CORAL, evo and Gas Town launch the agents. polyresearch stays on GitHub. A self-hosted remote where evaluation runs in the operator's own runner, and which never launches agents, is a distinct position. It is closest to AgentHub's original shape plus verification, which is what Karpathy said he wanted.

**Suggested PRD edits:**
- Replace "AgentHub and its forks … no scores and no claims" with the nuanced version in §0.1.
- Cite polyresearch, CORAL and Foremerge alongside GitHive, and note GitHive's independent-review option.
- Flag the "30 agents, same branch name" figure as unverified.
- Use the Gemma-collab metric gaming and convergence as the main evidence for the judge and computed context.
- Answer the "fewer agents / worktrees suffice" objection and Zechner's scepticism directly.
- Keep speculative and `within_noise` nodes visible, so promotion doesn't collapse into hill climbing (the PR #92 critique).
