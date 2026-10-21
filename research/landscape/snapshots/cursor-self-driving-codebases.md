# Cursor: Towards self-driving codebases

- URL: https://cursor.com/blog/self-driving-codebases (February 2026)
- Fetched: 2026-10-21 (WebFetch; model-extracted summary)

- Architecture: root planner ("A root planner owns the entire scope of the user's instructions"), recursive subplanners, workers in their own repo copy that "don't communicate with any other planners or workers"; an earlier judge role was removed.
- Coordination: no shared lock or coordination file in final design; handoffs flow up to the requesting planner.
- Failed: shared state file with locks (agents mishandled locks; 20 agents ran at throughput of 1-3); rigid planner/executor/worker/judge pipelines; an overloaded continuous executor; a central integrator for merges (bottleneck with hundreds of workers, removed).
- Merge: no central gate; workers push their own changes; tolerate a small steady error rate fixed later by other agents; requiring 100% correctness per commit serialised work. Suggests a final "green" branch with periodic cleanup (idea, not feature).
- Scale: ~1,000 commits/hour peak over a week; 10M tool calls; several hundred agents per run.
- Availability: internal research; "making part of this research available to try for some users."
- Related (search, secondary): Cursor 3 (2026-04-02) Agents Window runs parallel agents across local, SSH, worktrees and cloud; Cursor Automations (June 2026).
