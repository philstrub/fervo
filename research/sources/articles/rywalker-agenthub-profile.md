# AgentHub (Karpathy) - Ry Walker research profile (secondary source)

- Source URL: https://rywalker.com/research/agenthub
- Fetched: 2026-10-21 (curl + pandoc conversion; page chrome trimmed, content otherwise unedited)
- Note: third-party content, saved as data for reference.

---

← Back to research

Published March 10, 2026•Updated June 11, 2026·11 min read·company

AgentHub

AgentHub was Andrej Karpathy's agent-first collaboration platform — a bare git repo plus message board for swarms of AI agents working on the same codebase without branches, PRs, or merges. Karpathy took the repo private within days of launch; it survives via forks.

By Ry Walker, founder of Tembo and Astronomer.

https://github.com/karpathy/agenthub ↗

Represent this profile? Claim it or send a correction.

profilecoding-agentsopen-source

Key takeaways

- AgentHub replaced GitHub's human-centric model (branches, PRs, merges) with a sprawling DAG of commits and a message board — purpose-built for agent swarms
- Karpathy took the repo private within days of its March 2026 launch, without public explanation; the code survives only through community preservation forks
- The companion autoresearch project exploded to 86,000+ GitHub stars but has had no commits since March 26, 2026 — both projects read as sketches, not maintained software

FAQ

What is AgentHub?

AgentHub was Andrej Karpathy's open-source collaboration platform for AI agent swarms. It provided a bare git repo (commits via git bundles) and a message board for coordination — no branches, PRs, or merges. The original repo was taken private in March 2026 and the code now survives via community forks.

Is AgentHub still available?

Not from Karpathy. github.com/karpathy/agenthub returns 404 as of June 2026 — the repo was taken private within days of launch. Preservation forks such as ottogin/agenthub retain the original code, but none carry a license, leaving reuse legally ambiguous.

How is AgentHub different from GitHub?

GitHub is designed for human collaboration with branches, pull requests, and code review. AgentHub strips all of that away, leaving a DAG of commits going in every direction plus a message board for agents to coordinate asynchronously.

What is autoresearch?

Autoresearch is Karpathy's companion project where an AI agent autonomously runs ML training experiments on a single GPU. It remains public with 86,000+ stars as of June 2026, but has received no commits since March 26, 2026.

Is AgentHub production-ready?

No, and it never will be in its original form. Karpathy described it as "Work in progress. Just a sketch. Thinking..." and then withdrew the repo entirely. Treat it as a published idea, not software.

Executive Summary

  Status update (June 2026): Karpathy took the AgentHub repo private within days of launch — github.com/karpathy/agenthub returns 404 with no redirect, and the Wayback Machine holds no snapshot of the repo page. A preservation fork created March 11, 2026 (ottogin/agenthub, ~130 stars) retains the code.^([1][2]) Karpathy has made no public statement explaining the withdrawal. The companion autoresearch repo remains public at 86,000+ stars but has had no commits since March 26, 2026.^([3])

AgentHub was Andrej Karpathy's open-source, agent-first collaboration platform — a stripped-down alternative to GitHub designed for swarms of AI agents working on the same codebase.^([1]) Instead of branches, PRs, and merges, AgentHub exposed a bare git DAG where agents push commits via git bundles and coordinate through a built-in message board. The platform was generic by design — it didn't prescribe what agents optimize or how they coordinate. That "culture" comes from agent instructions, not the platform.

  Attribute      Value
  -------------- ----------------------------------------------------------------------------
  Creator        Andrej Karpathy
  Created        March 2026
  Status         Withdrawn — original repo private since mid-March 2026; survives via forks
  Funding        Open-source personal project
  Language       Go
  Headquarters   San Francisco, CA

------------------------------------------------------------------------

Product Overview

AgentHub was built as the organizational layer for autoresearch, Karpathy's project where AI agents autonomously run ML training experiments on a single GPU.^([3]) Autoresearch "emulates" a single PhD student doing research. AgentHub emulated a research community of them — an autonomous agent-first academia where contributors across the internet run autoresearch agents that collaborate through the hub. Autoresearch caught fire — 86,000+ stars and 12,000+ forks by June 2026, with notable community forks (including an AMD ROCm port) linked from its README^([3]) — but AgentHub itself was withdrawn before it could develop a community of its own.

The core thesis: GitHub's collaboration model (branches, PRs, code review, merge conflicts) was designed for human cognition and human-speed collaboration. Agents don't need any of that. They need a bare DAG they can push to and read from, plus a simple coordination channel.^([1])

Key Capabilities

  Capability             Description
  ---------------------- --------------------------------------------------------------------------------------------------------------------------------------------
  Git DAG                Bare repo — no main branch, no merges. Agents push via git bundles, fetch any commit, browse children/leaves/lineage, diff between commits
  Message board          Channels, threaded posts, replies. Agents post results, hypotheses, failures, coordination notes
  Auth + rate limiting   API key per agent, bundle size limits, per-agent push/post rate limits
  CLI (ah)               Thin CLI wrapping the HTTP API for agent use: join, push, fetch, log, post, read, reply

Architecture

    ┌─────────────┐     git bundles      ┌──────────────────┐
    │  Agent 1    │ ──────────────────── │                  │
    │  (Claude)   │                      │  agenthub-server │
    ├─────────────┤     HTTP API         │                  │
    │  Agent 2    │ ──────────────────── │  • SQLite DB     │
    │  (Codex)    │                      │  • Bare git repo │
    ├─────────────┤     message board    │  • Rate limiting │
    │  Agent N    │ ──────────────────── │                  │
    │  (Gemini)   │                      └──────────────────┘
    └─────────────┘        One Go binary

One Go binary (agenthub-server), one SQLite database, one bare git repo on disk. No containers, no runtime dependencies beyond git on the server's PATH.^([1])

------------------------------------------------------------------------

Technical Architecture

Git Layer

Agents interact via git bundles — the server validates and unbundles into a bare repo. The commit history forms a sprawling DAG going in every direction rather than converging into a main branch. Agents can:

- Push commits (bundle upload)
- Fetch any commit by hash
- Browse the DAG: children, leaves (frontier commits with no children), lineage (ancestry to root)
- Diff between any two commits

Message Board

Simple channel-based coordination: create channels, post to them, read posts, reply in threads. Agents post whatever they want — experimental results, hypotheses, failures, coordination notes. The platform imposes no structure on what gets posted.^([1])

Key Technical Details

  Aspect        Detail
  ------------- ------------------------------------------------------------------------------
  Deployment    Self-hosted, single binary
  Language      Go (static binary, cross-compile to Linux)
  Storage       SQLite + bare git repo
  Model(s)      Model-agnostic — agents bring their own LLM
  Auth          API key per agent, admin key for agent creation
  Rate limits   100 pushes/hour, 100 posts/hour per agent (configurable)
  Max bundle    50 MB default (configurable)
  Open Source   Was public, never licensed; original repo private since mid-March 2026^([2])

------------------------------------------------------------------------

Strengths

- Karpathy signal — 2,000+ stars in under 24 hours at launch. When Karpathy builds something, the AI community pays attention. The autoresearch project that AgentHub organized generated enormous discussion across X, Reddit, Substack, and YouTube and sits at 86,000+ stars^([3][4][5])
- Radical simplicity — One binary, one SQLite database, one git repo. No Kubernetes, no containers, no distributed systems. This is refreshing in a space drowning in infrastructure complexity
- Agent-native design — Strips away every human-centric GitHub concept (branches, PRs, merge conflicts, code review) and replaces them with primitives agents actually need: a DAG to push to and a board to post on
- Generic platform — Deliberately doesn't know or care what agents are optimizing. The "culture" comes from instructions, not the platform — making it applicable beyond ML research
- Distributed contribution model — The design let anyone run an autoresearch agent and contribute via AgentHub, a SETI@home-style distributed research network (now moot with the repo withdrawn)

------------------------------------------------------------------------

Cautions

- Withdrawn by its creator — The original repo was taken private within days of launch (a preservation fork dates to March 11, 2026; by March 17 press coverage already described it as "went private") with no public explanation from Karpathy.^([1][2]) The "Karpathy project risk" flagged in the original version of this profile materialized almost immediately
- No license, no archive — The repo never carried a license file, the surviving forks don't either, and the Wayback Machine has no snapshot of the original repo page. Building on the forked code is legally ambiguous (all-rights-reserved by default)^([1])
- No coordination intelligence — The platform itself is "dumb" — it doesn't help agents avoid duplicate work, resolve conflicts, or build on each other's results. All coordination logic must live in the agents' instructions
- Unproven at scale — SQLite + single binary is elegant for small-scale use but raises questions about concurrent access with dozens or hundreds of agents pushing simultaneously
- Companion project is dormant — autoresearch, the use case AgentHub was built to organize, has had no commits since March 26, 2026 despite 86,000+ stars and 185 open issues^([3]) — consistent with Karpathy's own caution that agentic systems remain "cognitively lacking" and need years of work^([6])

------------------------------------------------------------------------

What Developers Say

Launch-week reaction on X was effusive:

  "Andrej Karpathy just dropped AgentHub. It's literally GitHub, but redesigned entirely for AI agents. No main branches. No pull requests. Just a massive web of commits and a built-in message board where autonomous bots share test results and coordinate." — Oliver Molander (@OliverMolander) on X^([7])

  "The legend @karpathy did it again. He built AgentHub: a GitHub where AI agents are the users, not humans. No PRs. No merges. No main branch. Just agents pushing commits in parallel and posting results to each other. This is what agent-first infrastructure looks like." — Mario Valle Reyes (@bilbeny) on X^([8])

Notably, substantive developer discussion was thin: the Hacker News submission drew only 5 points and essentially no comments^([9]) — a striking contrast with the viral X/Instagram coverage, and a hint that the buzz was about Karpathy more than the software. We found no significant developer commentary on the repo's withdrawal either; the takedown passed largely unremarked outside a few blog posts noting the repo "went private."^([2]) The sharpest skepticism on record comes from Karpathy himself, who has called much of the current agentic-AI output "slop" and said agents are "cognitively lacking" — context that makes AgentHub's sketch-then-withdraw arc unsurprising.^([6])

------------------------------------------------------------------------

Pricing & Licensing

  Tier                     Price   Includes
  ------------------------ ------- -------------------------------------------------------------------
  Self-hosted (via fork)   Free    Full platform — but only from unofficial preservation forks^([1])

Licensing model: No license was ever specified, and the original repo is now private — the forked code is all-rights-reserved by default, making any serious use legally risky

Hidden costs: Requires a server with git installed. Agents bring their own LLM API costs.

------------------------------------------------------------------------

Competitive Positioning

Compared to Other Agent Collaboration Approaches

  Alternative   Differentiation
  ------------- ---------------------------------------------------------------------------------------------------------------------
  GitHub        GitHub is human-centric (branches, PRs, reviews). AgentHub is agent-native (DAG, bundles, message board)
  Gastown       Gastown orchestrates agents on a local machine. AgentHub is a remote collaboration platform for distributed agents
  Metaswarm     Metaswarm enforces quality gates and pipelines. AgentHub provides no workflow — just raw git + messaging primitives
  BEADS         BEADS is git-native issue tracking. AgentHub is git-native collaboration with a message board

When to Choose AgentHub Over Alternatives

- Choose AgentHub when: You want a design reference for agent-native collaboration — the withdrawn, unlicensed code is no longer a practical choice for running anything
- Choose Gastown/Metaswarm when: You need an orchestrator that actively manages agent workflows, quality gates, and merge coordination
- Choose GitHub when: Humans are in the loop for code review and you need the full PR/CI ecosystem
- Choose Tembo when: You need enterprise-grade agent orchestration with Jira integration, signed commits, and BYOK

------------------------------------------------------------------------

Ideal Customer Profile

Best fit:

- ML researchers running distributed autonomous experiments
- Agent framework developers exploring multi-agent collaboration patterns
- Developers who want a minimalist server for agent code sharing
- Anyone building on or extending Karpathy's autoresearch

Poor fit:

- Teams needing production-grade agent orchestration
- Enterprise deployments requiring access controls, audit trails, or compliance
- Projects requiring conflict resolution or merge coordination
- Anyone expecting a maintained, supported platform

------------------------------------------------------------------------

Viability Assessment

  Factor                Assessment
  --------------------- -------------------------------------------------------------------------------------------------------------------
  Financial Health      N/A (personal open-source project, now withdrawn)
  Market Position       Category-defining concept; the artifact itself is gone
  Innovation Pace       None — original repo private since mid-March 2026, forks unmaintained^([1][2])
  Community/Ecosystem   Viral launch (2K stars/day), but the surviving fork sits at ~130 stars with no commits since March 11, 2026^([1])
  Long-term Outlook     Dead as a project; alive as an idea

The open question from this profile's first edition — whether AgentHub would graduate from sketch to maintained project — has been answered: it didn't. Karpathy withdrew the repo within days, and the community did not rally around the forks (ottogin/agenthub: ~130 stars, no commits since the day it was forked).^([1]) The autoresearch ecosystem remains enormous on paper (86K+ stars) but is itself dormant since late March 2026.^([3])

------------------------------------------------------------------------

Bottom Line

AgentHub remains the most interesting conceptual contribution to the autonomous coding space this year: what if version control was designed for agents, not humans? The answer — a branchless DAG plus a message board — is elegantly minimal. But the project itself no longer exists: Karpathy took the repo private within days of launch, it was never licensed, and the preservation forks are unmaintained.^([1][2]) The value that survives is the idea: GitHub's collaboration model is a human artifact, and agents deserve their own primitives.

Recommended for: Reading the forked code as a design reference for agent-native collaboration infrastructure — nothing more.

Not recommended for: Any actual use — production or experimental. The code is unlicensed, withdrawn by its author, and unmaintained; even researchers building on autoresearch should treat AgentHub as a historical artifact.

Outlook: This profile's March 2026 prediction — that the "GitHub for agents" framing would influence the space regardless of whether the repo was maintained — stands, but the repo's fate resolved faster than expected: withdrawn in days, unmourned on Hacker News.^([9]) Watch for commercial and open-source implementations of the branchless-DAG-plus-message-board pattern through late 2026; AgentHub will be their citation, not their codebase.

------------------------------------------------------------------------

Research by Ry Walker • methodology

Disclosure: Author is CEO of Tembo, which offers agent orchestration as a commercial platform.

Sources

- [1] AgentHub Preservation Fork (ottogin/agenthub) — original karpathy/agenthub now 404
- [2] Karpathy's Agent-Native Infrastructure — Dev.to (notes repo went private)
- [3] Autoresearch GitHub Repository
- [4] Exploring Karpathy Autoresearch — Ken Huang (Substack)
- [5] Karpathy Autoresearch — The Neuron
- [6] Karpathy pours cold water on agentic AI hype — ITPro
- [7] Oliver Molander on AgentHub (X)
- [8] Mario Valle Reyes on AgentHub (X)
- [9] Andrej Karpathy's Agent Hub — Hacker News

Share on XShare on LinkedIn

On this page

- Executive Summary
- Product Overview
- Key Capabilities
- Architecture
- Technical Architecture
- Git Layer
- Message Board
- Key Technical Details
- Strengths
- Cautions
- What Developers Say
- Pricing & Licensing
- Competitive Positioning
- Compared to Other Agent Collaboration Approaches
- When to Choose AgentHub Over Alternatives
- Ideal Customer Profile
- Viability Assessment
- Bottom Line

Key takeaways

- AgentHub replaced GitHub's human-centric model (branches, PRs, merges) with a sprawling DAG of commits and a message board — purpose-built for agent swarms
- Karpathy took the repo private within days of its March 2026 launch, without public explanation; the code survives only through community preservation forks
- The companion autoresearch project exploded to 86,000+ GitHub stars but has had no commits since March 26, 2026 — both projects read as sketches, not maintained software

FAQ

What is AgentHub?

AgentHub was Andrej Karpathy's open-source collaboration platform for AI agent swarms. It provided a bare git repo (commits via git bundles) and a message board for coordination — no branches, PRs, or merges. The original repo was taken private in March 2026 and the code now survives via community forks.

Is AgentHub still available?

Not from Karpathy. github.com/karpathy/agenthub returns 404 as of June 2026 — the repo was taken private within days of launch. Preservation forks such as ottogin/agenthub retain the original code, but none carry a license, leaving reuse legally ambiguous.

How is AgentHub different from GitHub?

GitHub is designed for human collaboration with branches, pull requests, and code review. AgentHub strips all of that away, leaving a DAG of commits going in every direction plus a message board for agents to coordinate asynchronously.

What is autoresearch?

Autoresearch is Karpathy's companion project where an AI agent autonomously runs ML training experiments on a single GPU. It remains public with 86,000+ stars as of June 2026, but has received no commits since March 26, 2026.

Is AgentHub production-ready?

No, and it never will be in its original form. Karpathy described it as "Work in progress. Just a sketch. Thinking..." and then withdrew the repo entirely. Treat it as a published idea, not software.
