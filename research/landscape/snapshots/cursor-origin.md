# Cursor Origin (git forge)

- URLs: https://cursor.com/changelog/origin-code-hosting , https://cursor.com/docs/origin , https://cursor.com/origin ; secondary: https://www.eesel.ai/blog/what-is-cursor-origin
- Fetched: 2026-10-21 (WebFetch; model-extracted summaries, not verbatim copies)

## cursor.com/changelog/origin-code-hosting (dated 2026-08-17)
- Origin is Cursor's new code hosting; early beta rolling out to all paid plans (Enterprise orgs excluded if admins opt out).
- Codebase tab; repos at cursor.com/codebase/<name>. For Origin-hosted repos Origin is the source of truth, GitHub not in the path.
- GitHub sync: choose org and repos; near-real-time; GitHub stays source of truth for synced repos; PR comments and reviews sync both ways.
- Pull requests with timeline, commits, checks, changed files; review diffs, comment, merge.
- Agents work in every repo: ask questions, make changes, update PRs, push branches.
- App extensions: Vercel (previews, deploy on merge), Depot and Buildkite (CI; both run existing GitHub Actions workflows).
- "agent-native features ship soon".

## cursor.com/docs/origin
- "Git forge for hosting repositories, syncing from GitHub, and browsing code in the browser." Early beta.
- Code Tours walk reviewers through a PR.
- Create repos from Cursor agents; connect automations and cloud agents to Origin repos.
- Public API; private and public Origin Apps; Origin CLI; standard git clone/push/pull.
- Plans: available on Premium, Super, Ultra, Teams, Enterprise and legacy Start, Pro, Pro+, Ultra; "not available on Free or Plus." No self-hosting mentioned.

## cursor.com/origin
- Tagline: "A git forge for the agentic era". "Code is moving faster than any infrastructure was built to handle." "Origin was designed for this moment."

## Secondary (eesel.ai)
- Announced 2026-06-16 at Cursor's Compile conference; demoed by Graphite co-founder Tomas Reimers; stacked PRs carried over from Graphite.
- Demo scale claims (unverified): 22.6 commits/second in one repo; hundreds of thousands of clones/hour.
- No public pricing; no self-hosting.
