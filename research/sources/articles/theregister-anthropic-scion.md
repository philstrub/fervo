# The Register on Anthropic's Scion (Thomas Claburn, 2026-10-13; secondary coverage)

- Source URL: https://www.theregister.com/devops/2026/10/13/anthropic-reinvents-source-control-as-claude-floods-the-world-with-code/5302943
- Fetched: 2026-10-21 (curl + pandoc conversion; page chrome trimmed, content otherwise unedited)
- Note: third-party content, saved as data for reference.

---

Anthropic's Claude models have been emitting so much code that the company's coding infrastructure hasn't been able to keep up.

It's a symptom of the AI coding imperative and all-you-can-eat inference. Microsoft's GitHub in April published a [blog post](https://github.blog/news-insights/company-news/an-update-on-github-availability/) attributing recent [availability problems](https://www.theregister.com/software/2026/06/12/github-outages-persist-as-ai-coding-drives-traffic-surge/5255125) to the exponential growth in pull requests and commits. The code flood has been [noted](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6859839) by academic researchers, among others.

For Anthropic, writing code is no longer a productivity bottleneck. Instead, the problem is managing the code after it's written, via source control, the build system, and continuous integration.

REG AD

"In May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day," the biz said in a [blog post](https://www.anthropic.com/engineering/redesigning-source-control) on Tuesday.

REG AD

"We don’t expect this rate of growth to slow down anytime soon; the latent demand for merging code is practically infinite, and every bottleneck we remove immediately leads to a further increase in the amount of code we produce."

After several months of model prompting and five months of migration, the result is a homemade version control system called Scion, a monorepo scheme that sounds a bit like Subversion, Apache's centralized version control system.

Anthropic is not the first organization to look beyond Git's distributed architecture toward centralized source control. Google uses [Piper](https://dl.acm.org/doi/pdf/10.1145/2854146), a monorepo system (along with [Gerrit](https://opensource.google/projects/gerrit) for Git-based code reviews). Microsoft has Virtual File System for Git, formerly [GVFS](https://devblogs.microsoft.com/devops/announcing-gvfs-git-virtual-file-system/), to help overcome some of the scaling issues with Git. Meta has [Sapling](https://sapling-scm.com/).

But as the AI biz notes, Claude's code writing ability both created the situation and offered a way out through the creation of scalable code infrastructure tools – in addition to Scion, Claude helped conjure Antique (a code review interface), a code search tool, and a source control IAM system.

The decentralized approach embodied by Git is the right one for most code repos, according to Anthropic. But the company's main branch weighs in at about 100 GB, with a compressed working copy at more than a quarter of that.

"We perform on the order of 25 million code checkouts per day for CI, before counting developer environments, agent sandboxes, and research jobs," Anthropic said. "Fetched naively, that would be over 600 PB of git traffic per day."

Even with the tools Git provides for working with portions of a codebase, Anthropic says operations proved challenging.

Scion has been designed to meet the needs of AI agents, so the client leaves much of the work to the server; the source control queries are exposed via API so internal tools can respond without needing a local repo, and there's less synchronization but more need for server speed.

REG AD

"In Scion, the unit of work is a 'changeset,' an entry in a write-ahead log," Anthropic explains. "A changeset stores most of what you’d expect from a commit in git. But where a git commit stores a pointer to the tree, a changeset stores a list of the files that changed relative to its first parent, along with content-addressed pointers to the compressed file contents in blob storage."

Work on Scion started in January, and when Claude Mythos Preview became available internally, Anthropic's code coaxers told the model to rewrite an early Git-to-Scion ingestion pipeline. The much-hyped model produced a version that used 20 times less memory and ran four times as fast. When cost is no object thanks to ample venture funding, that sort of token spending just makes sense.

Anthropic's Claude jockeys appear to be taking their obsolescence in stride. According to the AI biz, company developers who worked on Scion agree that Claude writes better code than they do. But they still possess a higher-level understanding that gives them a role as naysayers. 

"Very often, we found that the role of the engineers was to tell Claude 'no,'" Anthropic said. "Agents will sometimes violate core system constraints to satisfy a pattern that should never have been allowed in the first place."

"Just say no." As a slogan, it's timeless. And it's never been more relevant. 

Anthropic says its bespoke system isn't right for general use. There will be no open source release. Nonetheless, the company contends that its own code scaling problems will become commonplace in other organizations over the next few months, so it wanted to share its approach – having ample funding to pay for writing custom infrastructure tools. ®
