# autoresearch-at-home - Ry Walker research profile (secondary source)

- Source URL: https://rywalker.com/research/autoresearch-at-home
- Fetched: 2026-10-21 (curl + pandoc conversion; page chrome trimmed, content otherwise unedited)
- Note: third-party content, saved as data for reference.

---

← Back to research

Published March 13, 2026•Updated June 11, 2026·5 min read·company

Autoresearch at Home

SETI@home-style collaborative autoresearch — multiple AI agents on different GPUs coordinate via Ensue shared memory to avoid duplicate work and collectively optimize. Dormant since March 2026, but the coordination primitives remain a useful reference.

By Ry Walker, founder of Tembo and Astronomer.

https://github.com/mutable-state-inc/autoresearch-at-home ↗

Represent this profile? Claim it or send a correction.

autoresearchcoding-agentsopen-sourcepythongithubmulti-agent

Key takeaways

- First distributed autoresearch implementation — multiple agents on different GPUs share results via Ensue shared memory, avoiding redundant experiments
- Four coordination primitives: experiment claiming (prevent duplicates), result sharing, global best tracking, and hypothesis exchange
- Proven once at small scale — the first coordinated run had 20+ agents complete 1,000+ experiments in 54 hours, improving validation performance 3.2%
- Dormant since March 13, 2026 — no commits since launch week, mirroring the stall of Karpathy's upstream autoresearch and the withdrawal of AgentHub

FAQ

What is autoresearch-at-home?

A SETI@home-style collaborative fork of Karpathy's autoresearch. Multiple AI agents on different machines coordinate through shared memory to avoid duplicate experiments and collectively drive down validation loss.

Is autoresearch-at-home still maintained?

Effectively no. As of June 2026 the repository has had no commits since March 13, 2026 — three days after creation. It is not archived, and stars have grown to roughly 487, but development stopped in launch week.

What happens if the coordination network goes down?

Agents continue running solo. The Ensue coordination layer is additive — it prevents duplicate work and shares results, but isn't required for individual agent operation.

Overview

Autoresearch-at-home is a collaborative fork of Karpathy's autoresearch that enables multiple AI agents on different GPUs to work together as a research swarm. Instead of isolated agents duplicating work, agents coordinate through shared memory to claim experiments, share results, and track the global best configuration.

Directly inspired by Karpathy's tweet: "The next step for autoresearch is that it has to be asynchronously massively collaborative for agents (think: SETI@home style). The goal is not to emulate a single PhD student, it's to emulate a research community of them."

Status (June 2026): the project is dormant. The repository's last commit is March 13, 2026 — three days after creation — and there has been no activity since. It is not archived, and stars have grown from ~188 at profile time to roughly 487 as of June 11, 2026, with 29 forks. The stall mirrors its upstream: Karpathy's autoresearch has been dormant since late March 2026, and AgentHub, the collaboration platform meant to host this kind of swarm, was withdrawn by Karpathy within days of launch.

Coordination Primitives

  Primitive              What it does
  ---------------------- ----------------------------------------------------------------------------------------------------------------------------
  Experiment claiming    Agents claim work before starting. Semantic similarity checking prevents near-duplicates. Claims auto-expire if abandoned.
  Result sharing         Every experiment (success or failure) is published with full source code for reproducibility.
  Global best tracking   The swarm maintains a shared best config that agents periodically pull and adopt as their baseline.
  Hypothesis exchange    Agents publish research ideas for others to pick up — a coordination mechanism beyond just sharing results.

Architecture

The project is an open-source Python codebase hosted on GitHub, maintained by Mutable State Inc. All coordination happens through Ensue shared memory. Key design choice: Git stays local. The network is additive — if Ensue goes down, agents continue running solo without losing progress. This is defensive distributed systems design.

Adoption & Results

The first (and, as far as the public record shows, only) coordinated run is documented on the Ensue blog: 20+ agents completed over 1,000 experiments in 54 hours and improved validation performance by 3.2%. The Show HN launch drew 79 points and 19 comments. As of June 2026 there is no evidence of subsequent coordinated runs.

Pricing

The software is free and open source. Running an agent costs GPU rental plus LLM API usage: the setup guide recommends an H100/H200 on Vast.ai at roughly $2–4/hour — about $16–32 for an overnight 8-hour session producing ~100 experiments — plus an Anthropic API key for Claude Code.

Strengths

- First implementation of multi-agent research coordination
- Graceful degradation (agents work independently if network fails)
- Semantic similarity prevents near-duplicate experiments
- Hypothesis exchange is a novel coordination primitive
- Clean separation of local execution from distributed coordination

Cautions

- Dormant since launch week — no commits since March 13, 2026, three days after the repo was created
- Stalled ecosystem — Karpathy's upstream autoresearch has been inactive since late March 2026, and AgentHub was withdrawn; the movement this fork rode is paused
- Depends on Ensue — a third-party service from the same small team; the swarm's value proposition disappears if Ensue does
- Small community — ~487 stars, 29 forks, and a single documented coordinated run
- GPU barrier — meaningful participation requires an 80GB-class GPU rental, which limits the "at home" framing

What Developers Say

Reaction on the Show HN thread (79 points, 19 comments) was positive but small-scale:

  "Incredibly cool. I can think of plenty of use cases this can apply to (e.g., drug research, trading)." — ahmedhawas123 on Hacker News

Critical feedback in the same thread: zmanian noted the site should make the GPU requirement clearer, and gabia reported broken GitHub commit links when trying to inspect agent-generated code. Creator austinbaggio acknowledged the GPU barrier, pointing to cheap Vast.ai rentals and older gaming PCs, and committed to a live dashboard — which, given the repo's dormancy, never shipped. We found no substantive developer commentary after launch week.

Bottom Line

Not recommended for use as of June 2026 — the project stopped moving three days after it started, its upstream is dormant, and its coordination ecosystem (AgentHub) was withdrawn. But as a design reference it remains the most strategically interesting artifact of the autoresearch moment: the coordination primitives — claiming, sharing, tracking, and hypothesis exchange — are exactly what any multi-agent orchestration platform needs, whether for research or software engineering. Outlook: revival is unlikely unless the broader autoresearch wave restarts; the ideas will more likely resurface inside commercial agent-orchestration platforms than in this repo.

------------------------------------------------------------------------

Research by Ry Walker • methodology

Sources

- [1] mutable-state-inc/autoresearch-at-home GitHub
- [2] Karpathy's tweet on collaborative autoresearch
- [3] Ensue blog: autoresearch@home — set up an AI research agent in 10 minutes
- [4] Show HN: Autoresearch@home — Hacker News
- [5] autoresearch-at-home commit history

Share on XShare on LinkedIn

On this page

- Overview
- Coordination Primitives
- Architecture
- Adoption & Results
- Pricing
- Strengths
- Cautions
- What Developers Say
- Bottom Line

Key takeaways

- First distributed autoresearch implementation — multiple agents on different GPUs share results via Ensue shared memory, avoiding redundant experiments
- Four coordination primitives: experiment claiming (prevent duplicates), result sharing, global best tracking, and hypothesis exchange
- Proven once at small scale — the first coordinated run had 20+ agents complete 1,000+ experiments in 54 hours, improving validation performance 3.2%
- Dormant since March 13, 2026 — no commits since launch week, mirroring the stall of Karpathy's upstream autoresearch and the withdrawal of AgentHub

FAQ

What is autoresearch-at-home?

A SETI@home-style collaborative fork of Karpathy's autoresearch. Multiple AI agents on different machines coordinate through shared memory to avoid duplicate experiments and collectively drive down validation loss.

Is autoresearch-at-home still maintained?

Effectively no. As of June 2026 the repository has had no commits since March 13, 2026 — three days after creation. It is not archived, and stars have grown to roughly 487, but development stopped in launch week.

What happens if the coordination network goes down?

Agents continue running solo. The Ensue coordination layer is additive — it prevents duplicate work and shares results, but isn't required for individual agent operation.
