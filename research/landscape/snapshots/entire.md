# Entire (Thomas Dohmke)

- URLs: https://entire.io/news/entire-launches-distributed-git-network-for-the-agent-era ; https://entire.io/blog/entire-dispatch-0x0001 ; https://github.com/entireio/cli ; secondary: https://siliconangle.com/2026/07/08/ex-github-chiefs-entire-opens-distributed-git-network-agent-era/
- Fetched: 2026-10-21 (WebFetch / WebSearch; model-extracted summaries)

## Distributed git network announcement (2026-07-08)
- Waitlist preview; mirror an existing GitHub repo in one step; agents clone and pull from a regional mirror (US, EU, Australia).
- Company benchmarks: ~570,000 clones/hour (200 simulated clients); ~586 pushes/second with 128 simulated agents; mixed ~470 ops/s at ~50-60 ms p50. Claims "up to 25x" better than competitors, naming Cursor Origin. Benchmark suite public.
- Roadmap: native hosting of new public and private repos "in coming months"; "fully decentralize the network, enabling data residency, sovereignty, and scale in any region." Will open-source the git backend (no date or license).
- Semantic memory layer (launched February): stores each agent session, prompt, tool call and checkpoint in the repo next to the code.
- Entire Blame: agent session and prompt behind each line.
- Entire Review: sends a branch to multiple agents in parallel for an intent-aware review.
- Code + semantic search over changes and reasoning.
- Integrates with Claude Code, Codex, Cursor, Factory, GitHub Copilot.
- 40+ employees. Pricing not mentioned.

## Dispatch 0x0001 (2026-02-14)
- Checkpoints "automatically captures agent context as first-class, versioned data in Git." Open-source CLI (github.com/entireio/cli). Metadata on branch entire/checkpoints/v1.
- Gemini CLI support; Gitleaks secret detection; hook chaining; web UI checkpoint view.

## Funding (secondary)
- $60M seed led by Felicis at ~$300M valuation (February 2026).
