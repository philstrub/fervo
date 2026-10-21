# Claude Code: agent teams

- URL: https://code.claude.com/docs/en/agent-teams
- Fetched: 2026-10-21 (WebFetch; excerpts)

- "Agent teams are experimental and disabled by default." Enabled via CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
- Components: team lead (main session), teammates (separate Claude Code instances), shared task list, mailbox (JSON file per agent at ~/.claude/teams/{team}/inboxes/{agent}.json).
- Tasks: pending / in progress / completed, with dependencies. "Task claiming uses file locking to prevent race conditions when multiple teammates try to claim the same task simultaneously."
- Quality gates via hooks: TeammateIdle, TaskCreated, TaskCompleted (exit code 2 blocks).
- "Two teammates editing the same file leads to overwrites. Break the work so each teammate owns a different set of files."
- Limitations: one team per session, scoped to that session; no nested teams; no session resumption for in-process teammates; task status can lag; lead fixed.
- Single-machine, single-session, Claude-only coordination; no scoring, no merge policy, no cross-provider review.
