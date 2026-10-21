# Pawsly (Jindo AI): coordination layer for parallel coding agents

- URL: https://hackernoon.com/four-ai-coding-agents-one-codebase-and-a-coordination-problem (company site jindoai.net)
- Author/date: James Jin (Jindo AI founder), 2026-10-08
- Fetched: 2026-10-21 (WebFetch; model-extracted summary)

- Sits "between the tools where your team decides things and the agents that write the code."
- Shared decision record linking Slack threads, Linear issues, GitHub PRs.
- Plan with owners: drafts roles, milestones, dependencies for team approval.
- Check before action: agents connect over MCP and declare intent; checked against team decisions -> aligned or blocked.
- Handoffs of accepted commits between dependent milestones.
- Verified merge: one integrator combines role branches; separate verifier checks against milestones before human review.
- Self-reported CooperBench (10 tasks): four agents matching code 3 -> 9/10 vs shared git; passing tasks unchanged at 6/10. "Coordination made the agents agree. It did not make them right." Cost ~1.5x agent steps (951 vs 630).
- Hosting and pricing not stated; seeking design partners.
