# GitHub: Building Git infrastructure for agent-scale development

- URL: https://github.blog/engineering/building-git-infrastructure-for-agent-scale-development/
- Date: 2026-10-06 (updated 2026-10-07), Brian Celenza
- Fetched: 2026-10-21 (WebFetch; model-extracted summary)

- Pushes up 4.9x YoY (0.69B to 3.35B/month); PR merges nearly 4x; Actions 3.26B runs in September (4x+); 7.38B commits in September (5x+); git events 218.2B to 473.3B/month.
- Spokes (five full copies, three-phase commit) couples durability and scale; new design moves authoritative data to Azure Blob Storage with caching compute workers; "Coordinate only what needs agreement" (only ref updates); maintenance off the serving path; up to 35x write throughput in internal benchmarks.
- Merges identified as a bottleneck (trunk-based dev, release trains, merge queues funnel onto one ref); commits to keep branch protections, required reviews, audit logs: "Keep people in control of their code."
- "Agentic software development is driving the next architectural shift." First post in a series.
