# GitButler: Series A and agent features

- URLs: https://blog.gitbutler.com/series-a ; https://docs.gitbutler.com/features/ai-integration/claude-code-hooks ; https://blog.gitbutler.com/agents-tab ; secondary https://www.startuphub.ai/ai-news/investors-news/2026/gitbutler-raises-22m-series-a
- Fetched: 2026-10-21 (WebFetch / WebSearch; model-extracted summaries)

## Series A post (Scott Chacon)
- "GitButler has raised a $17M Series A", led by a16z with Fly Ventures and A Capital; Peter Levine joins board. (StartupHub reported $22M, dated 2026-04-08; official post says $17M.)
- "We're not building some 'better git'." "We're building the infrastructure for how software gets built next."
- CLI "for humans, designed for agents, designed for scripting."
- Planned: agents aware of what other agents and teammates are working on; early warnings about merge conflicts between teammates; stacking on a coworker's branch.
- No forge/hosting plans mentioned in the post. Source public on GitHub (Fair Source / Open Source Pledge member per site link).

## Agent features (docs, search)
- Claude Code hooks (`but claude pre-tool`, `post-tool`, `stop`) route parallel sessions' edits into separate virtual/stacked branches in one workspace.
- Agents Tab launches Claude Code sessions tied to branches; Claude Code currently the only supported agent.
