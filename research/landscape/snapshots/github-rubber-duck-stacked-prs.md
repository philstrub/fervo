# GitHub: Rubber Duck cross-model review; stacked PRs GA; async merge API

- URLs: https://www.helpnetsecurity.com/?p=365053 (Rubber Duck coverage) ; https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/ ; https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/ ; https://github.blog/changelog/2026-10-01-github-async-merge-api-generally-available/
- Fetched: 2026-10-21 (WebFetch / WebSearch; model-extracted summaries)

## Rubber Duck (announced 2026-04-07; expanded 2026-05-07)
- Review agent in Copilot CLI (experimental) that "runs on a different model family than the primary session". Claude orchestrator -> GPT-5.4 reviewer; May update: GPT orchestrators can use a Claude-powered Rubber Duck.
- Runs automatically after plan drafting, complex implementation, and test writing; agent can call it when stuck.
- Rationale: "Different model families carry different training biases."
- GitHub-reported: "Claude Sonnet + Rubber Duck makes up 74.7% of the performance gap between Sonnet and Opus alone" on SWE-Bench Pro.

## Stacked pull requests
- Public preview 2026-07-30; GA 2026-10-06 on all github.com plans (GHES later). A stack enters and lands through the merge queue as one merge group. GitHub reports repos using stacks see 9% more merged code. `gh stack` CLI extension.
- Async merge API GA 2026-10-01 (the only merge API supporting stacked PRs).
