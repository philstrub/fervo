# Parallel-agent orchestrators (search-result notes)

- Fetched: 2026-10-21 (WebSearch result summaries; mostly secondary sources)

- Conductor (conductor.build; https://rywalker.com/research/conductor): Mac app running Claude Code, Codex, Cursor agents in parallel, each workspace a git worktree; YC S24; reported $22M Series A (Spark, Matrix), aggregator-dated 2026-03-30; free locally, Pro $50/month, Teams $60/user/month (reviewer summary); uses the user's own Claude login.
- Sculptor (https://imbue.com/product/sculptor): Imbue's open-source app for parallel coding agents; free in beta (June 2026 review).
- Vibe Kanban (https://vibekanban.com/blog/shutdown): Bloop shut down 2026-04-10; project continues Apache-2.0, local-only; self-hostable multi-user via Docker Compose, unsupported.
- Emdash (https://www.ycombinator.com/companies/emdash): YC W26, open-source provider-agnostic desktop app, agents in worktrees.
- Terminal Use (https://www.ycombinator.com/companies/terminal-use): YC W26, "Vercel for background agents".
- Cognition (https://siliconangle.com/?p=846143): $2B+ at $48B valuation (2026-09-08 report); ~$900M run-rate; MultiDevin parallel tasks; Windsurf rebranded Devin Desktop (June 2026).
- Factory (https://factory.ai/news/series-c): $150M Series C led by Khosla at $1.5B (2026-04-16).
- OpenHands (https://openhands.dev/blog/introducing-the-openhands-cloud): OpenHands Cloud runs multiple agents; $18.8M Series A (Nov 2025, Madrona); core OSS.
- Amp (https://tessl.io/blog/sourcegraph-spins-out-ai-coding-agent-amp-as-a-standalone-company/): spun out of Sourcegraph Dec 2025; Thread Map shows threads/handoffs as a graph.
- Kiro autonomous agent (https://www.techcrunch.com/2025/12/02/amazon-previews-3-ai-agents-including-kiro-that-can-code-on-its-own-for-days/): AWS "frontier agent", runs for days, multi-repo; "will not check in the code until you do".
- Google Jules: parallel cloud-VM tasks since 2025; April 2026 report of "Jitro" (Jules V2) in development (https://www.testingcatalog.com/google-prepares-jules-v2-agent-capable-of-taking-bigger-tasks/).
- MCP Agent Mail (https://github.com/Dicklesworthstone/mcp_agent_mail): advisory exclusive/shared file-glob leases, pre-commit guard, inbox/outbox stored in git + SQLite.
- Gas Town / Beads (Steve Yegge): OSS orchestrator + git-backed issue tracker; Simon Willison reports Gas Town "fell apart" with a model change (https://simonwillison.net/tags/steve-yegge). No company or funding found.
- Hyperspace AI: p2p autoresearch network with CRDT-synced global leaderboard; 660 agents / 27,247 experiments by April 2026 (https://rywalker.com/research/hyperspace-agi).
