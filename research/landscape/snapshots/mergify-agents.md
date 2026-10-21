# Mergify: Merge queues and AI coding agents

- URL: https://mergify.com/blog/merge-queues-and-ai-coding-agents
- Author/date: Julien Danjou, 2026-07-13
- Fetched: 2026-10-21 (WebFetch; model-extracted summary)

- Argument: queues designed for human-paced change; with agents at 10x-1,000x volume a single serial lane falls behind; bottleneck shifts to release throughput (correct changes landed per hour).
- Quotes Mitchell Hashimoto: "merge queues work for humans at a certain scale, but push that scale by 100x or 1,000x"; "it's not an AI review problem, it's really just a release problem."
- Danjou: "The thing you validated is the thing your users get."
- Shipping: speculative testing in parallel lanes; batching; bisection on failure; scopes (monorepo graph); two-step CI; automatic rebasing / fast-forward of tested SHA.
- Agent-specific: Test Engine classifies tests healthy/flaky/broken from rerun history, queryable by agents via CLI; CI Insights.
- Planned: treat the "change" (not SHA) as primary identity so rebases keep reviews/test results.
- Hosting: Mergify Cloud (hosted) and Mergify Enterprise Server (in your network; GitHub Enterprise Server or GitHub.com). Pricing not stated in article.
- Related (search): Mergify Agent Skills for its CLI (https://docs.mergify.com/cli/agents).
