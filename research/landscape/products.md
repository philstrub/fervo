# Fervo competitive landscape: companies, products and platform features

*Compiled 2026-10-21. Scope: companies, commercial products, big-platform features. Individual open-source hobby projects are covered elsewhere and appear here only when they set the bar (GitHive, MCP Agent Mail, Gas Town).*

**Method and caveats.** Each claim below comes from a page fetched or a search result returned on 2026-10-21. The URL is given inline. Snapshots of the key pages are in `snapshots/`. Those snapshots are extracted summaries, not verbatim copies. Funding and pricing marked "(secondary)" come from aggregators or press and were not confirmed on a primary page. Where a cell says "n/s", the sources I read did not state it. It does not mean the feature is absent.

---

## 1. Comparison table

Column key:

- **Launches agents?** Does the product start and run the working agents? Fervo never does.
- **Shared context / claims:** computed shared state, declarations of intent, file or path leases.
- **Independent eval:** scoring or review by something other than the authoring agent.
- **BYO keys:** the operator's own model keys or self-hosted models.

| Product | Category | Hosted / self-hosted | Launches agents? | Shared context / claims | Independent eval | Merge policy | BYO keys | Open source? | Pricing / funding | URL |
|---|---|---|---|---|---|---|---|---|---|---|
| **Fervo** (proposal) | Repo-management harness | Self-hosted only, hosts nothing | **No** | Computed `context`, declarations, soft-warning claims, memory of tried directions | Runner-scored frontier (metrics + pinned judge, k samples, noise-aware); no self-review; reviews counted per provider | Policy file: verify-then-merge or merge-then-verify with auto-revert; human override | **Yes, required** | Planned | n/a | PRD.md |
| GitHub: Copilot coding agent, Agent HQ / Mission Control, Copilot app, Agent Merge | Code host + agents | Hosted (GHES mentioned for stacked PRs) | Yes (Copilot + third-party agents via Agent HQ; partner agent apps) | Context from issues/PRs; each session in its own worktree; no claims | Copilot code review tiers; **Rubber Duck: reviewer from a different model family** (experimental, CLI) | Branch protection, required reviews, merge queue; **stacked PRs GA 2026-10-06**; Agent Merge waits for CI + reviewers | n/s | No | Copilot Pro/Pro+/Business/Enterprise + Max; 4.7M paid Copilot subs (Jan 2026, secondary) | [Copilot app](https://github.blog/news-insights/product-news/github-copilot-app-the-agent-native-desktop-experience/), [stacked PRs GA](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/), [agent-scale git](https://github.blog/engineering/building-git-infrastructure-for-agent-scale-development/) |
| Cursor Origin (+ Graphite, cloud agents) | Agent-native forge | Hosted only | Yes (Cursor agents in every repo; cloud agents) | Agents ask/modify within repo; Code Tours; no claims found | Graphite Agent AI review; Cursor Code Review | PRs, checks, merge; Graphite stack-aware merge queue | n/s | No | Paid Cursor plans only (not Free or Plus); Graphite $20 / $40 per user; Graphite acquired Dec 2025, price undisclosed | [changelog](https://cursor.com/changelog/origin-code-hosting), [docs](https://cursor.com/docs/origin), [Graphite pricing](https://graphite.com/blog/introducing-graphite-agent-and-pricing) |
| Entire (Thomas Dohmke) | Git network + agent memory | Hosted mirror network (waitlist); Checkpoints CLI is OSS | No (integrates Claude Code, Codex, Cursor, Factory, Copilot) | **Semantic memory: sessions, prompts and tool calls versioned in git**; Entire Blame | **Entire Review: branch sent to multiple agents in parallel for intent-aware review** | n/s | n/s | CLI yes; backend "will be" OSS | $60M seed, ~$300M valuation (secondary) | [launch](https://entire.io/news/entire-launches-distributed-git-network-for-the-agent-era), [dispatch](https://entire.io/blog/entire-dispatch-0x0001) |
| OpenAI: reported code host; Codex cloud; Ona | Rumoured agent-first forge + cloud agents | Reported hosted; Ona adds self-hosted sandboxes | Yes | n/s | Codex code review (secondary) | Reported: agents "propose and merge pull requests" | n/s | Codex CLI OSS | Ona deal announced 2026-06-11, terms undisclosed | [Techstrong](https://techstrong.ai/articles/openai-moves-to-challenge-microsoft-with-agent-first-github-rival/), [SiliconANGLE](https://siliconangle.com/2026/06/11/openai-acquires-ai-agent-orchestration-startup-ona/) |
| GitLab Duo Agent Platform | Code host + agents | Hosted, Self-Managed, Dedicated | Yes (foundational, custom, and external Claude Code / Codex) | AI Catalog flows; MCP client | Code Review flow | GitLab MR approvals | **Self-hosted models on Self-Managed** | n/s | Credits: $12 / $24 per user per month included | [GA blog](https://about.gitlab.com/blog/gitlab-duo-agent-platform-is-generally-available/) |
| Atlassian Rovo Dev / Bitbucket | Code host + agent | Hosted | Yes | Jira/Confluence context | Rovo Dev Code Reviewer | Bitbucket PRs | n/s | No | n/s | [eesel overview](https://eesel.ai/blog/rovo) (secondary) |
| Tangled | Federated forge (AT Protocol) | Self-host "knots" + hosted | No (agents can open PRs and review via XRPC API) | n/s | n/s | Stacked PRs, CI | n/a | Yes | $4.5M seed (byFounders; Dohmke angel) | [SiliconANGLE](https://siliconangle.com/2026/03/02/tangled-announces-4-5m-round-build-github-alternative-built-blueskys-protocol/) |
| Radicle | P2P forge | Self-hosted / P2P | No | n/s | n/s | Patches + review | n/a | Yes | n/s | [Habr 1.7 note](https://habr.com/ru/articles/1012752) (secondary) |
| SourceHut / Codeberg / Forgejo | Community forges | Self-host or nonprofit hosting | No | n/a | n/a | n/a | n/a | Yes | n/a | [SourceHut ToS](https://sourcehut.org/blog/2026-08-27-tos-changes-and-llms/), [Forgejo report](https://forgejo.org/2026-03-monthly-report/). **SourceHut now prohibits LLM-written content; Forgejo bans AI contributions to Forgejo itself** |
| Pierre Code Storage | Git infra "for machines" | Hosted; BYO cloud | No | n/a | n/a | n/a | n/a | No | Usage: $0.005/GB/hr hot storage etc.; "$23M led by CRV + O1A" (site banner) | [code.storage](https://code.storage/) |
| Graphite (Cursor) | Review + stacking + merge queue | Hosted | Cursor cloud agents inside PRs | n/a | Graphite Agent AI review | Stack-aware merge queue | n/s | CLI yes | Hobby free; Starter $20; Team $40 | [pricing](https://graphite.com/blog/introducing-graphite-agent-and-pricing) |
| Mergify | Merge queue + CI insights | Cloud + Enterprise Server (self-hosted) | No | n/a | **Test Engine classifies tests healthy / flaky / broken; agents can query it** | Speculative lanes, batching, bisection, scopes, two-step CI | n/a | No | n/s | [blog](https://mergify.com/blog/merge-queues-and-ai-coding-agents) |
| Aviator (Runbooks + MergeQueue) | Spec-driven agents + merge queue | Cloud or self-host | **Yes (Claude Code sandboxes)** | Specs; review feedback captured into context files | Human PR review | MergeQueue | n/s | Templates only | n/s; 1,000+ teams (secondary) | [agents](https://aviator.co/agents) |
| Trunk Merge Queue | Merge queue | Hosted | No | n/a | n/a | Merge queue; multiple queues per repo | n/a | No | n/s | [docs](https://docs.trunk.io/merge-queue/merge-queue) |
| CodeRabbit | AI code review | Hosted | Slack agent (CodeRabbit Agent) | n/a | AI review, CLI inside agent loops | n/a | n/s | No | CLI $0.25 per file add-on; $143M Series C at $1.5B (Aug 2026, secondary) | [CLI add-on](https://coderabbit.ai/blog/introducing-usage-based-add-on-allow-unrestricted-access-to-coderabbit-cli-through-agentic-coding-loops), [WSGR](https://ecvc.wsgr.com/news/wilson-sonsini-advises-coderabbit-on-dollar143-million-series-c-funding) |
| Greptile | AI code review | Hosted | No | n/s | AI review (v3) | n/a | n/s | No | $25M Series A, Benchmark (Sept 2025, secondary) | [SiliconANGLE](https://siliconangle.com/2025/09/23/greptile-bags-25m-funding-take-coderabbit-graphite-ai-code-validation/) |
| Qodo | Multi-agent code review | Hosted / enterprise | No | Full-repo context | Specialist review agents + filter layer; ranked first on Martian Code Review Bench precision (secondary) | n/a | n/s | n/s | $70M Series B, Mar 2026 | [SiliconANGLE](https://siliconangle.com/2026/03/30/ai-generated-code-verification-startup-qodo-raises-70m/) |
| Ellipsis / Bito | AI code review | Hosted | No | n/a | AI review | n/a | n/s | No | ~$20 (Ellipsis) and ~$12–15 (Bito) per seat (secondary) | [costbench](https://costbench.com/compare/bito-vs-ellipsis/) |
| GitButler | Agent-aware git client | Local | No (Agents Tab launches Claude Code) | Planned: "agents aware of what other agents and teammates are working on" | n/a | n/a | n/a | Source public | $17M Series A, a16z | [Series A](https://blog.gitbutler.com/series-a) |
| Jujutsu (jj) / Sapling (Meta) | VCS | Local | No | n/a | n/a | n/a | n/a | Yes | n/a | [wavect jj guide](https://wavect.io/blog/git-worktrees-vs-jujutsu-ai-coding-agents/), [ezyang Sapling](https://blog.ezyang.com/2026/03/parallel-agents-heart-sapling/) |
| Anthropic Scion (+ Antique) | Internal VCS + review | Internal only | n/a | Derived data; API access | Antique semantic approval rules; reviewers check intent | Post-merge testing, no global merge-queue lock | n/a | **No, not available** | n/a | [post](https://www.anthropic.com/research/redesigning-source-control) |
| Oak / Diversion / Freestyle | Agent-oriented VCS / git API | Mostly hosted | No | Diversion plans "why" capture | n/a | n/a | n/a | n/s | n/s | [Oak](https://www.developersdigest.tech/blog/oak-version-control-agents-git-alternative), [Diversion](https://www.diversion.dev/blog/diversion-version-control-for-an-agentic-world), [Freestyle](https://www.freestyle.sh/blog/engineering/version-control-for-ai-agents) |
| Conductor | Parallel-agent workspace (Mac) | Local; Pro adds cloud workspaces | Yes (worktree per agent) | n/a | Human review in app | Human | Uses your Claude login | No | Free local; Pro $50/mo; $22M Series A (secondary) | [rywalker](https://rywalker.com/research/conductor) |
| Sculptor (Imbue) / Emdash (YC W26) / Vibe Kanban | Parallel-agent workspaces | Local | Yes | n/a | n/a | Human | Yes (your agents) | Yes | Vibe Kanban's company **shut down Apr 2026** | [Sculptor](https://imbue.com/product/sculptor), [Vibe Kanban](https://vibekanban.com/blog/shutdown) |
| Cursor cloud agents / "self-driving codebases" | Agent harness | Hosted | Yes (planner → workers) | Hierarchical handoffs, **no shared lock file (it failed)** | Judge role tried, then removed | **No central gate; tolerate small error rate** | n/s | No | n/s | [blog](https://cursor.com/blog/self-driving-codebases) |
| Claude Code agent teams | Harness feature | Local | Yes | **Shared task list with file-locked claims, mailboxes** | Hooks as gates | None (git) | Claude models only | No | Part of Claude Code | [docs](https://code.claude.com/docs/en/agent-teams) |
| Augment Intent | Orchestration workspace | Local (macOS) | Yes (BYO agent: Claude Code, Codex, OpenCode) | **Living spec, coordinator** | **Verifier agent checks results against the spec** | Prompt → PR → merged in app | Augment credits | No | Credits | [blog](https://www.augmentcode.com/blog/intent-a-workspace-for-agent-orchestration) |
| Warp Oz | Cloud agent control plane | Hosted or self-hosted (enterprise, K8s) | Yes (Claude Code, Codex, Warp agent) | Shared team context; cross-harness memory (secondary) | n/s | n/s | n/s | Terminal/ADE open-sourced (secondary) | n/s | [launch](https://warp.dev/newsroom/2026/2/10/warp-launches-oz-the-orchestration-platform-for-cloud-coding-agents) |
| Devin (Cognition) / Factory / OpenHands / Jules / Kiro / Amp / Codex | Autonomous agents | Hosted (OpenHands also OSS) | Yes | Per-vendor | Per-vendor | n/s | n/s | OpenHands, Codex CLI | Cognition $48B (secondary); Factory $150M at $1.5B; OpenHands $18.8M A | see §2.10 |
| Pawsly (Jindo AI) | **Coordination layer** | n/s (design partners) | No | **Shared decision record, plan with owners, intent checked before action (MCP)** | **Separate verifier vs milestones** | One integrator merges role branches, then human review | n/s | n/s | n/s | [HackerNoon](https://hackernoon.com/four-ai-coding-agents-one-codebase-and-a-coordination-problem) |
| GitHive | Coordination + merge | Hosted (invite-only); "deploy your own" docs | Optional hosted Builder/Reviewer agents | **Path claims that refuse overlaps**; signed records in git | Peer agent votes with evidence; Clef drift checks | Batch merge with bisection | No (own models) | MIT | n/s | [repo](https://github.com/nuandy/githive) |
| MCP Agent Mail / Beads / Gas Town | OSS coordination | Self-hosted | Gas Town: yes | Advisory file leases (Agent Mail); git-backed issues (Beads) | n/a | Gas Town merge-queue agent | Yes | Yes | n/a | [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) |
| W&B (CoreWeave): Weave, ARIA | Experiment tracking + evals | Hosted | ARIA research agent | Experiment history | **Eval framework** | n/a | n/s | n/s | Part of CoreWeave | [search summary](https://lasvegassun.com/news/2026/jun/29/coreweave-aria-launches-as-an-ai-research-and-iter/) (secondary) |
| Hyperspace AI | P2P autoresearch network | Network | Yes (network agents) | CRDT-synced global leaderboard, findings over GossipSub | Metric leaderboard | n/a | n/s | Repo public (secondary) | n/s | [rywalker](https://rywalker.com/research/hyperspace-agi) (secondary) |

---

## 2. Significant players

### 2.1 GitHub (Copilot coding agent, Agent HQ, Copilot app, git rebuild): threat **HIGH**

**What it does.**

- **Agent HQ / Mission Control** (Universe 2025) is a hub for assigning and tracking Copilot and third-party agents (Anthropic, OpenAI, Google, Cognition, xAI). [sdtimes](https://sdtimes.com/ai/github-unveils-agent-hq-the-next-evolution-of-its-platform-that-focuses-on-agent-based-development/)
- **The Copilot app** (Build, 2026-06-02) gives each session its own worktree. It adds "Canvases", cloud and local sandboxes, and **Agent Merge**, which monitors CI, tracks required reviewers, fixes failing checks and merges once conditions are met. [blog](https://github.blog/news-insights/product-news/github-copilot-app-the-agent-native-desktop-experience/)
- **Rubber Duck** (2026-04-07) is a reviewer that "runs on a different model family than the primary session". GitHub's stated rationale: "Different model families carry different training biases." [helpnetsecurity](https://www.helpnetsecurity.com/?p=365053)
- **Stacked PRs went GA on 2026-10-06.** A stack lands through the merge queue as one group. [changelog](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/)
- **GitHub is rebuilding its git storage for "agent-scale development"** (2026-10-06). Pushes are up 4.9x year on year, merges about 4x, and internal benchmarks show up to 35x write throughput. It promises to keep "branch protections, required reviews, audit logs". [blog](https://github.blog/engineering/building-git-infrastructure-for-agent-scale-development/)
- **Agent apps** in the Marketplace let partner agents (Sonar, Endor Labs, PagerDuty and others) take issues and @mentions. [changelog](https://github.blog/changelog/2026-06-02-extend-github-with-agent-apps/)
- **Universe 2026 is on 2026-10-28/29, a week from now.** Expect more here.

**What it does that Fervo doesn't:**

- hosting, identity and CI (Actions) at scale;
- running the agents itself;
- the distribution of millions of paid seats;
- an existing compliance story;
- native stacking with a merge queue.

**What Fervo does that it doesn't:**

- no scored frontier, and no metric-based promotion;
- no noise-aware acceptance;
- no queryable record of failed directions;
- no claims or declarations, since GitHub isolates agents with worktrees instead of coordinating them;
- cross-family review exists only as an *advisory* critic inside one Copilot CLI session, not as a merge-policy primitive that counts verdicts per provider;
- no merge-then-verify with auto-revert as policy;
- no self-hosted runner where every LLM call uses the operator's keys.

**Why high:**

- GitHub has explicitly made "agent scale" its roadmap.
- It already ships the review-gating pieces Fervo's pitch implies are missing.
- The PRD's claim that GitHub "can't be changed" is weaker after stacked PRs, Agent Merge and agent apps.
- Each Fervo core feature is small enough for GitHub to ship as one changelog entry, and "reviews from a different model family" is already half-shipped.

### 2.2 Cursor Origin + Graphite + Cursor agents: threat **HIGH**

**What it does.**

- Cursor announced Origin, "a git forge for the agentic era", at Compile on 2026-06-16. The early beta started on 2026-08-17 for paid plans.
- Origin provides repos, PRs, checks, two-way GitHub sync, agents in every repo, a public API, an Origin CLI, and Vercel, Depot and Buildkite apps.
- "Agent-native features ship soon." [changelog](https://cursor.com/changelog/origin-code-hosting), [docs](https://cursor.com/docs/origin), [eesel](https://www.eesel.ai/blog/what-is-cursor-origin)
- Cursor acquired Graphite (announced 2025-12-19), bringing stacked PRs, a stack-aware merge queue and Graphite Agent review. [TechCrunch](https://techcrunch.com/2025/12/19/cursor-continues-acquisition-spree-with-graphite-deal)
- Cursor's research harness peaked at about 1,000 commits/hour with several hundred agents. [blog](https://cursor.com/blog/self-driving-codebases)

**What it does that Fervo doesn't:** a hosted forge, its own agents and model, a merge queue, and a large paying user base.

**What Fervo does that it doesn't:**

- self-hosting, since Origin is hosted only;
- provider neutrality, since Origin is Cursor-centric and paid-plan-only;
- scoring, claims and independent per-provider review.

**Why high:**

- This is exactly the "GitHub for agents" pitch, from a well-funded company.
- It already absorbed the leading merge-queue and stacking team.
- **Useful evidence for Fervo:** Cursor reports that shared lock files failed ("20 agents ran at the throughput of 1-3"), that a central integrator became a bottleneck, and that requiring correctness on every commit serialised work. That supports Fervo's soft claims and `merge_then_verify`. It also warns that heavy coordination primitives get abandoned.

### 2.3 Entire (ex-GitHub CEO Thomas Dohmke): threat **HIGH**

**What it does.**

- **Checkpoints** is an open-source CLI that stores agent transcripts, prompts, tool calls and token usage in git, on `entire/checkpoints/v1`.
- **A distributed git mirror network** entered waitlist preview on 2026-07-08, with regions in the US, EU and Australia.
- **Entire Blame** shows the session and prompt behind each line.
- **Entire Review** "sends a branch to multiple agents in parallel for an intent-aware review."
- On the roadmap: native hosting, then a "fully decentralize[d]" network, with the git backend to be open-sourced.
- Funding: $60M seed at about $300M (secondary). [news](https://entire.io/news/entire-launches-distributed-git-network-for-the-agent-era), [SiliconANGLE](https://siliconangle.com/2026/07/08/ex-github-chiefs-entire-opens-distributed-git-network-agent-era/)

**What it does that Fervo doesn't:** a network-scale git backend and rich capture of agent reasoning, with Dohmke's credibility behind it.

**What Fervo does that it doesn't:** none of these appeared in the material read: a scored frontier, claims, merge policy, or per-provider counting. Entire stores *reasoning*. Fervo stores *outcomes against a metric*.

**Why high:**

- Same thesis: git hosting built for humans breaks under agents.
- Same "migrate by mirroring from GitHub" on-ramp.
- Same "intent-aware review", and the Checkpoints CLI is free.
- If Entire adds outcome tracking or merge policy, it covers most of Fervo's story with distribution Fervo lacks.

### 2.4 Coordination layers: Pawsly (Jindo AI) and GitHive: threat **MEDIUM-HIGH** (conceptually the closest)

**Pawsly** (2026-10-08) is a "coordination layer" that sits "between the tools where your team decides things and the agents that write the code". It offers:

- a shared decision record across Slack, Linear and GitHub;
- a plan with owners;
- **agents that declare intent over MCP**, which is checked before they act;
- handoffs between dependent milestones;
- **a separate verifier** before one integrated merge.

Its own CooperBench result: four agents produced matching code on 3 of 10 tasks with shared git and 9 of 10 with Pawsly, but **passing tasks stayed at 6 of 10**. In the author's words: "Coordination made the agents agree. It did not make them right." It cost about 1.5x the agent steps. [HackerNoon](https://hackernoon.com/four-ai-coding-agents-one-codebase-and-a-coordination-problem)

**GitHive** (MIT, Cloudflare stack) offers path claims that refuse overlaps, peer-agent votes with evidence, batch merge with bisection, signed records in git, Git URL / GitHub import, MCP and a dashboard. The hosted service is invite-only, and the repo had 2 stars at fetch time. [repo](https://github.com/nuandy/githive)

**What they do that Fervo doesn't:**

- Pawsly ties decisions to the tools teams already use (Slack, Linear, PRs).
- GitHive runs the whole stack hosted.

**What Fervo does that they don't:**

- a metric- and judge-scored frontier with noise-aware promotion;
- negative-result memory;
- per-provider counting;
- operator-keys-only evaluation.

**Why medium-high:**

- Declarations and claims are already built by at least two independent teams.
- Pawsly's published result is a direct warning that **declarations alone do not improve correctness**. Fervo's pitch must rest on the frontier and the evaluation, not on claims.

### 2.5 Merge-queue vendors: Mergify, Aviator, Trunk, Graphite: threat **MEDIUM**

**Mergify** (2026-07-13) re-pitches its queue for agents. It quotes Mitchell Hashimoto: "it's not an AI review problem, it's really just a release problem". It ships:

- speculative lanes, batching, bisection and monorepo scopes;
- a **Test Engine that labels tests healthy, flaky or broken, which agents can query**. This is the nearest commercial analogue to Fervo's "noise-aware" idea.

It also plans to treat a "change" rather than a SHA as the identity of work. It comes as a cloud service or a self-hosted Enterprise Server. [blog](https://mergify.com/blog/merge-queues-and-ai-coding-agents)

**Aviator** runs Claude Code agents in its own sandboxes from Runbooks (specs) and lands their stacked PRs through its MergeQueue. It can be self-hosted. [agents](https://aviator.co/agents)

**Trunk**'s 2026 changelog shows queue features but nothing agent-specific. [docs](https://docs.trunk.io/merge-queue/merge-queue)

**What they do that Fervo doesn't:** mature batching, bisection and flake detection at scale.

**What Fervo does that they don't:** scoring beyond pass/fail, claims, judge-based ranking, and memory of directions tried. Also merge-then-verify as a first-class mode, although Cursor and Anthropic both describe that as the agent-scale answer.

**Why medium:** they own "safe landing" and are layered on GitHub, which is where customers are. Fervo should plug into them, not compete.

### 2.6 AI code review: CodeRabbit, Qodo, Greptile, Graphite Agent, Ellipsis, Bito: threat **MEDIUM** (commoditises Fervo's "review" plugin)

**Funding and products:**

- CodeRabbit: $143M Series C at $1.5B (Aug 2026, secondary, [WSGR](https://ecvc.wsgr.com/news/wilson-sonsini-advises-coderabbit-on-dollar143-million-series-c-funding)). It sells a usage-based CLI for "agentic coding loops" at $0.25 per file. [blog](https://coderabbit.ai/blog/introducing-usage-based-add-on-allow-unrestricted-access-to-coderabbit-cli-through-agentic-coding-loops)
- Qodo: $70M Series B (2026-03-30). Its multi-agent review uses specialist agents plus a coordinating filter layer. [SiliconANGLE](https://siliconangle.com/2026/03/30/ai-generated-code-verification-startup-qodo-raises-70m/)
- Greptile: $25M Series A (2025).

**What they do that Fervo doesn't:** tuned review models and benchmarks.

**What Fervo does that they don't:**

- the reviewer is separated from the author by construction;
- provider counting;
- review tied to a declared intent and a goal;
- review as one weighted input to a merge policy.

**Why medium:** review quality is a solved-enough, crowded market. Fervo should treat these tools as verdict producers.

### 2.7 GitLab Duo Agent Platform: threat **MEDIUM**

**What it does.** It went GA on 2026-01-15 on GitLab.com, Self-Managed and Dedicated. It offers:

- foundational and custom agents and flows (issue to MR, fix pipeline, code review);
- **external agents (Claude Code, Codex)**;
- an MCP client with approval;
- **self-hosted models on Self-Managed**;
- credits of $12 / $24 per user per month. [blog](https://about.gitlab.com/blog/gitlab-duo-agent-platform-is-generally-available/)

**What it does that Fervo doesn't:** a whole self-hosted DevOps platform with BYO models. That is Fervo's "self-hosted plus your own models" pitch at enterprise grade.

**What Fervo does that it doesn't:** a frontier, claims, provider-independent verdicts, and a minimal core.

**Why medium:** it is the incumbent answer for teams that want self-hosted agents, though it is heavyweight and seat-priced.

### 2.8 Harness-native coordination: Claude Code agent teams, Augment Intent, Warp Oz, Cursor planners: threat **MEDIUM**

- **Claude Code agent teams** (experimental) provide a shared task list where "task claiming uses file locking", plus mailboxes and hooks (`TaskCompleted`) as gates. They are scoped to a single session and a single machine. [docs](https://code.claude.com/docs/en/agent-teams)
- **Augment Intent** has a coordinator with a "living spec", a **verifier agent** that checks results against the spec, and BYO agents (Claude Code, Codex, OpenCode). [blog](https://www.augmentcode.com/blog/intent-a-workspace-for-agent-orchestration)
- **Warp Oz** is a cloud and self-hosted control plane across Claude Code, Codex and Warp's own agent, with audit trails. [launch](https://warp.dev/newsroom/2026/2/10/warp-launches-oz-the-orchestration-platform-for-cloud-coding-agents)

**Why medium:** for single-vendor swarms, coordination comes bundled with the harness. Fervo's wedge is **mixed-provider swarms and multiple sessions on one repo**, which these tools do not address, or address only inside one vendor.

### 2.9 Code-host infra and alternative forges: Pierre, Tangled, Radicle, SourceHut / Codeberg / Forgejo: threat **LOW** (with one opportunity)

- **Pierre Code Storage** is white-label git infra "for machines", with customers including Lovable, Bolt and Amp. It has usage pricing and a reported $23M raise. It is infrastructure, not workflow. [code.storage](https://code.storage/)
- **Tangled** (AT Protocol) has self-hosted "knots", agents that can open PRs and review through its API, and a $4.5M seed. It is a possible *remote* for Fervo, not a competitor. [SiliconANGLE](https://siliconangle.com/2026/03/02/tangled-announces-4-5m-round-build-github-alternative-built-blueskys-protocol/)
- **The opportunity:** community forges are turning against AI.
  - **SourceHut's new ToS bans "original content written with or which facilitates the use of LLMs"**, and AI-using projects "are required to migrate away". [blog](https://sourcehut.org/blog/2026-08-27-tos-changes-and-llms/)
  - Codeberg announced limits on LLM use in July (secondary).
  - Forgejo prohibits AI-generated contributions to Forgejo itself. [report](https://forgejo.org/2026-03-monthly-report/)
  - So self-hosting agent-heavy, privacy-minded open-source projects lose their non-GitHub homes. A "`fervo serve` on your own box" story fits them.

### 2.10 Agent vendors: Cognition/Devin, Factory, Codex, Jules, Kiro, OpenHands, Amp, Conductor: threat **LOW-MEDIUM**

These companies *launch* agents, which Fervo deliberately does not. They are Fervo's users' tools, not substitutes.

- Cognition: about $48B valuation (secondary), MultiDevin parallel tasks. [SiliconANGLE](https://siliconangle.com/?p=846143)
- Factory: $150M Series C at $1.5B. [factory.ai](https://factory.ai/news/series-c)
- OpenAI: reported agent-first code host ([Techstrong](https://techstrong.ai/articles/openai-moves-to-challenge-microsoft-with-agent-first-github-rival/)) and the Ona acquisition for self-hosted sandboxes ([SiliconANGLE](https://siliconangle.com/2026/06/11/openai-acquires-ai-agent-orchestration-startup-ona/)).
- Conductor (reported $22M A), Sculptor and Emdash isolate agents in worktrees and leave merging to a human.
- Vibe Kanban's company shut down in April 2026 because it couldn't find a business model with mostly-free users ([shutdown](https://vibekanban.com/blog/shutdown)). That is a caution for any free developer tool in this category.

**The risk is the OpenAI code host**, if it ships. It would be a second "agent-first GitHub" from a model vendor.

### 2.11 VCS innovation: Scion, GitButler, jj, Sapling, Oak, Diversion: threat **LOW**

- **Scion** is internal. Anthropic says "Scion is by no means a suitable replacement for git for general use." Its lessons ("examine the intent of the change", semantic approval rules, post-merge testing instead of a merge-queue lock) are already in Fervo's design. [post](https://www.anthropic.com/research/redesigning-source-control)
- **GitButler** ($17M a16z) is a local client with Claude Code hooks. It plans agents that are "aware of what other agents and teammates are working on", which could overlap with Fervo's `context` and claims. [Series A](https://blog.gitbutler.com/series-a)
- **jj and Sapling** are good local substrates.

These change storage and the client, not coordination or evaluation, so Fervo can sit on top of any of them.

### 2.12 Eval / experiment platforms: W&B (CoreWeave), Hyperspace: threat **LOW** (as a frontier analogue)

- W&B Weave and ARIA (June 2026) provide an eval framework and a research agent over experiment data. W&B also reportedly ships a coding-agent session dashboard and an MCP server (secondary). [search summary](https://lasvegassun.com/news/2026/jun/29/coreweave-aria-launches-as-an-ai-research-and-iter/)
- Hyperspace runs a P2P autoresearch network with a CRDT leaderboard. It reached 660 agents and 27,247 experiments by April 2026 (secondary), then drifted toward crypto. [rywalker](https://rywalker.com/research/hyperspace-agi)

Both rank *experiments*. Neither ties ranking to which branch may merge into `main`.

---

## 3. White space

**Combinations nobody offers (in what I found):**

1. **A merge gate driven by a scored frontier.** Ranking branches by `Σ w·metric + w_j·judge`, with confidence intervals against a measured noise floor, and letting that ranking decide promotion and merge. Close neighbours:
   - Mergify flags flaky tests;
   - W&B and Hyperspace rank experiments;
   - Cursor and GitHub gate on pass/fail CI.

   Nobody joins "is it better, beyond noise?" to "may it land?".
2. **Negative results as first-class, queryable repo state.** "Directions tried → `worse` / `within_noise` / `rejected`" returned to every new agent. Entire stores *transcripts*, Pawsly stores *decisions*, and GitHive stores *claims and votes*. None stores *outcomes of abandoned directions*.
3. **Review independence written into merge policy.** The rules: the author never counts, verdicts are counted per provider, only measured evidence counts, and the judge prompt and benchmarks are pinned and tamper-proof. GitHub's Rubber Duck proves vendors believe in cross-family review, but it is an advisory critic inside one session. GitHive, as the PRD reads it, lets the author's agent review its own change "in a fresh context" (not re-verified in the README summary I fetched).
4. **Mixed-provider swarms on one repo, coordinated with no hosted service and no vendor model.** Claude Code agent teams, Cursor, Intent and Oz each coordinate inside their own harness or cloud. GitLab self-managed is the only self-hosted, BYO-model option, and it is a full DevOps suite rather than a minimal core.

**Already commoditised:**

- **Parallel isolation** (worktrees or sandboxes per agent): GitHub Copilot app, Conductor, Sculptor, Emdash, Intent, Cursor.
- **Claims, leases and task locking:** Claude Code task-list file locks, MCP Agent Mail leases, GitHive path claims, Pawsly intent checks. Fervo's soft-warning claims are a nice detail, not a moat. Cursor's data suggests heavy locking is actively harmful.
- **AI code review:** CodeRabbit, Qodo, Greptile, Graphite Agent, Copilot, Entire Review, Rovo Dev. It is a funded, crowded market.
- **Merge queues with batching, bisection and speculative lanes:** Mergify, Trunk, Graphite, Aviator, GitHub, GitHive.
- **Stacked changes:** GitHub (GA), Graphite, GitButler, Tangled, Aviator.
- **Importing and mirroring from GitHub:** Cursor Origin, Entire, Pierre, Diversion, GitHive, and Tangled (planned). `fervo import --mirror` is table stakes.
- **Agent provenance and audit trails:** Entire Checkpoints, Warp Oz, GitHive signed records.
- **MCP endpoints and dashboards:** everyone.
- **Self-hosting with your own models:** GitLab Self-Managed, Mergify Enterprise Server, Aviator, Warp Oz. "Hosts nothing" is a principle, not a differentiator on its own.

**Bottom line:** of Fervo's five core objects, three (claims, review, policy-gated merge) are commodities. One (computed context) is partly covered by Entire and harness memory. **Only the frontier, together with its independence rules, is unclaimed.**

---

## 4. Positioning recommendations

1. **Drop "Fervo replaces GitHub" as the headline.**
   - Against this landscape it is not credible. GitHub is rebuilding its storage for agent scale, Cursor (with Graphite) and Entire are building agent-native forges with large funding, and OpenAI reportedly is too.
   - It also clashes with "hosts nothing". A CLI that runs next to a bare repo is not a GitHub replacement, and reviewers will notice.
   - Keep `fervo serve` as an option, but pitch Fervo as **"the frontier for agent swarms: decides which branch is ahead and whether it may land, on any git remote."** Treat "you can leave GitHub" as a consequence, not the claim.
2. **Narrow to repos with a measurable objective.**
   - The frontier is the only unclaimed idea, and it is strongest where `metric` is real: autoresearch, performance and kernel tuning, benchmarked libraries, eval-driven prompt and agent repos.
   - Make that the first customer: a solo researcher running 2–10 mixed-provider agents. General product repos with judge-only scores are where Fervo is weakest and the incumbents are strongest.
3. **Lead with negative-result memory and noise-aware promotion, not claims.**
   - Pawsly's own data shows declarations make agents *agree* but not *right*.
   - Fervo's demo should report the metric reached at equal tokens, duplicated *directions* avoided, and `within_noise` results that stopped wasted work. Claims become an implementation detail.
4. **Make independence the trust brand, and make it testable.**
   - Ship the misuse suite from the PRD as a public benchmark: self-review, same-provider "independent" reviews, editing the pinned judge, and prompt injection in comments.
   - Show that GitHive-style "fresh context" self-review and single-family reviewers fail it. This is something GitHub's Rubber Duck and Entire Review do not claim to enforce.
5. **Integrate, don't rebuild, the commoditised pieces.**
   - Treat CodeRabbit, Qodo, Copilot review, Rubber Duck and Entire Review as *verdict producers*, counted by provider.
   - Use Mergify, GitHub or Graphite merge queues as the *merge backend* behind a Fervo policy.
   - Use Entire Checkpoints as a *context provider*. Every integration makes Fervo the neutral scoring layer in front of the tools teams already pay for.
6. **Ship the GitHub-attached mode first, self-hosted second.**
   - A GitHub App or Action posts `frontier_score ± ci`, `delta_vs_parent` and `within_noise` as a check, and the policy engine gates merge.
   - That reaches the people who are actually on GitHub. `fervo serve` then serves the self-hosting and AI-refugee niche, for example projects pushed off SourceHut by its new LLM ban, and teams that won't send code to Cursor's or Entire's clouds.
7. **Own "multi-provider by default".** Harness-native coordination (Claude Code agent teams, Cursor planners, Intent, Oz) covers single-vendor swarms. Fervo's natural user runs Claude Code, Codex and pi side by side and wants none of those vendors to grade its own work. Say that explicitly.
8. **Plan for the incumbents to copy features, and keep the core small enough to be the standard.**
   - GitHub could ship "count reviews by model family" in one changelog entry.
   - The defensible assets are a pinned, versioned judge-template library, the scoring and noise formula, and an open `fervo.toml` policy schema that other tools can adopt.
   - The PRD's "pi of repo management" framing fits this better than "GitHub replacement".

*Watch list for the next month:*

- GitHub Universe (2026-10-28/29);
- Cursor Origin's promised "agent-native features";
- Entire's native hosting and open-sourced backend;
- whether OpenAI's code host ships;
- Pawsly's hosting model.
