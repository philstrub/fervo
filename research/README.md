# Fervo research

Background research for the Fervo PRD (`../PRD.md`), gathered on 2026-10-21.
**Start with [differentiation.md](differentiation.md)**, which combines everything below into one picture: what is already done elsewhere, what is new, what to change, and what to fix in the PRD.

| Folder / file | What's in it |
|---|---|
| [differentiation.md](differentiation.md) | Synthesis: the bottom line, prior art, the open gap, the literature's design challenges, positioning, PRD corrections, interviewees, watch list |
| [sources/sources.md](sources/sources.md) | Every source the PRD cites or names, checked against the original, ending in a 27-row table that checks each PRD claim |
| [sources/articles/](sources/articles/) | Markdown copies of those sources (19 files): Anthropic's source-control and red-team posts, GitHive's README, design doc and docs, the AgentHub README (from a fork), autoresearch and autoresearch@home, Karpathy's X posts, pi's blog post and README, GitHub's Copilot coding agent, Agent HQ and availability posts, The Register on Scion, the harnesses' headless modes, Virgil |
| [papers/papers.md](papers/papers.md) | 40 papers in 8 themes, each with a summary and its relevance to Fervo, plus key takeaways |
| [papers/pdf/](papers/pdf/) | 37 PDFs (about 123 MB), named `<year>-<author>-<slug>.pdf` |
| [landscape/products.md](landscape/products.md) | Commercial landscape: a table of about 35 products, threat levels, white space and positioning |
| [landscape/open-source-and-people.md](landscape/open-source-and-people.md) | AgentHub and autoresearch derivatives, a 39-repo table, people, real pain-point quotes, an interview shortlist |
| [landscape/snapshots/](landscape/snapshots/) | Page and README snapshots (33 files). **These are model-written summaries, not verbatim copies**, so check against the live page before quoting |

## The key links

**Cited in the PRD**
- Anthropic, [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control) (2026-10-13): Scion
- Anthropic Frontier Red Team, [Patterns and problems in emerging multiagent systems](https://www.anthropic.com/research/multiagent-systems) (2026-08-13): the 18-of-30 branch-name result
- GitHive: [repo](https://github.com/nuandy/githive), [site](https://githive.app), [docs](https://docs.githive.app)
- Karpathy's AgentHub: the original `github.com/karpathy/agenthub` now returns 404. Surviving copies: [ottogin/agenthub](https://github.com/ottogin/agenthub), [ygivenx/agenthub](https://github.com/ygivenx/agenthub). No X post by Karpathy announcing AgentHub was found; his 2026-03-08 "SETI@home" post, which sets out the idea, is in [karpathy-x-posts.md](sources/articles/karpathy-x-posts.md)
- [karpathy/autoresearch](https://github.com/karpathy/autoresearch) (98,301★), [autoresearch-at-home](https://github.com/mutable-state-inc/autoresearch-at-home)
- pi: [repo](https://github.com/earendil-works/pi), [Zechner's blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- GitHub: [Copilot coding agent](https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/), [Agent HQ](https://github.blog/news-insights/company-news/welcome-home-agents/), [availability update](https://github.blog/news-insights/company-news/an-update-on-github-availability/)

**Closest prior art found in this research**
- [superagent-ai/polyresearch](https://github.com/superagent-ai/polyresearch): independent re-run verification, full attempt history
- [Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL) ([paper](https://arxiv.org/abs/2604.01658)): shared attempts, hidden grader, rubric judges
- [huggingface/agent-collabs](https://github.com/huggingface/agent-collabs): leaderboard with re-run verification; [Gemma challenge write-up](https://agent-collaborations-gemma-collab-lessons.hf.space/), which documents metric gaming
- Pawsly (Jindo AI): intent declarations plus a verifier. See [the HackerNoon write-up of its benchmark](https://hackernoon.com/four-ai-coding-agents-one-codebase-and-a-coordination-problem)
- Foremerge, MCP Agent Mail, Beads, Gas Town, Entire and Cursor Origin: links in [landscape/](landscape/)

## Caveats

- Everything was fetched on 2026-10-21. Star counts, prices and funding change, and figures marked "(secondary)" in `products.md` came from aggregators.
- Blog quotes in `open-source-and-people.md` went through a tool that extracts page text, so re-check them before pasting them into the PRD. X pages could not be fetched directly.
- Three papers could not be downloaded (the ACM Digital Library blocked two, and the AAAI site was down for the third). They are listed with links in `papers.md`.
- Downloaded material is untrusted data. Nothing was cloned, installed or run.
