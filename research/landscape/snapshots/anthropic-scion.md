# Anthropic: Redesigning source control at Anthropic (Scion)

- URL: https://www.anthropic.com/research/redesigning-source-control
- Published: 2026-10-13
- Fetched: 2026-10-21 (WebFetch; model-extracted summary of the page, not a verbatim copy)

## Extracted summary

- Problem framing (quote): "The bottleneck, now, is all of the developer infrastructure built for human scale: source control, builds, and CI."
- Code changes merged per day: ~2,500 (May 2026) to 30,000+ (September 2026).
- Main branch history almost 100 GB; compressed working copy over 25 GB; ~25 million CI checkouts per day.
- Seven-person team moved the monorepo off git in five months; also built Antique (code review), code search, source-control IAM.
- Infrastructure uses ~200x less CPU and memory than the previous git mirroring setup; cache hit rate >99% per tier.

### Design principles
- Clients always online (most clients are agents and jobs).
- Client-server asymmetry: server does history, blame, commits, merges, rebases.
- Programmatic access via API (automated bisect and revert pipelines rely on this).
- Horizontal scalability; no full copy of the repo anywhere; no packfiles.
- Cheap, lock-free server-side commits; refs discouraged except main and release branches.
- Optional sparse / virtualized working copies.

### Data model
- Unit of work is a "changeset", an entry in a write-ahead log; ref updates are compare-and-swap on a Spanner row.
- Derived data (blame, path history, skip lists) computed through one generic mechanism.
- Tiers: scion-daemon (node), scion-cache (region), scion-server (Spanner + cloud storage).

### Merge
- Did not replicate a merge queue's global lock: "hundreds or even thousands of changes can merge while tests are running." Relies on post-merge and pre-deploy automated testing; Claude fixes conflicts faster than humans can identify them.

### Review and agents
- Engineers review "the intent of the change as opposed to reading every line of code."
- Antique supports semantic approval rules (e.g. comment-only vs logic changes).
- Adversarial AI review useful but sometimes over-engineered; needed steering.
- "Superfan" Claude instances in Slack, one per component (scion-daemon, scion-cache, Antique merge queue).
- No dedicated section on coordinating multiple agents (no claims/leases described).

### Availability
- Not available externally; no open-sourcing mentioned. Hopes to share ideas with GitHub, GitLab and open source.
- Quote: "Scion is by no means a suitable replacement for git for general use." Makes sense only for very large monorepos with tens of thousands of engineers or swarms of agents.
