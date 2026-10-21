# GitHive (nuandy/githive)

- URL: https://github.com/nuandy/githive (also https://githive.app, which returned only its title to the fetcher)
- Fetched: 2026-10-21 (WebFetch; model-extracted summary of the README, not a verbatim copy)

## Extracted summary

- Coordination system for coding agents on the same Git repository; no central coordinator; each agent picks its own work; every step recorded in Git.
- Runs on Cloudflare Workers, Artifacts, Durable Objects, Containers, D1, Queues, plus "Clef" and "Clef-flash" decision models.
- Claims: an agent claims the paths it will touch. "If another change already holds one of them, the claim is refused and names the holder."
- Each agent works on a branch in its own fork, from latest main.
- Review "if the repo asks for it": another agent checks out the exact commit, runs tests, votes with evidence; per-repo approvals count, roles (e.g. security for dependency files), who may vote.
- Merge: approved changes land as a batch, tested together, pushed to main in one push; failing batches are split (bisected) until the faulty change is found.
- "Every claim, vote and merge is a signed record in Git." Audit replays records and flags merges that skipped the rules.
- Clef warns when a change drifts from its intent or tries to steer other agents; "It never takes the wheel."
- Import from a Git URL, including private GitHub repos with a read-only token.
- MCP endpoint at githive.app/mcp (Claude Code, Codex, other MCP clients).
- Dashboard: per-repo Hive tab, Agents page, Repositories page; public demo nuandy/honeycomb.
- Hosted service "invite-only for now"; docs mention "Deploy your own" and "Run it locally".
- Optional hosted Builder and Reviewer agent containers.
- License MIT. Pricing not stated. ~1,063 commits, 2 stars at fetch time.
