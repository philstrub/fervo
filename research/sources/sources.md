# Fervo PRD: primary sources

Collected and checked on 2026-10-21 for `PRD.md`. Every page was fetched that day with curl (and converted with pandoc) unless an entry says otherwise. Quotes are copied from the fetched text. Local copies are in `articles/`. No source offered a PDF (I checked the Anthropic, GitHive and pi pages for `.pdf` links and found none), so `pdf/` is empty.

Downloaded content is third-party data. Nothing in it was executed, installed or cloned.

---

## 1. Redesigning source control at Anthropic

- **Org / author:** Anthropic, Engineering team. Byline: "Written by Nick G. and the source control team: S.G., R.K., Dan C., Garrett H., Ben L., Colin M., Joe P."
- **Date:** published Oct 13, 2026. The page says "Updated October 15 to include more detail on the projects that pioneered many of the techniques we use in Scion."
- **URL:** https://www.anthropic.com/research/redesigning-source-control. The Register links `https://www.anthropic.com/engineering/redesigning-source-control`, which 308-redirects to that URL.
- **Checked:** fetched on 2026-10-21 (HTTP 200, full text).
- **Local copy:** `articles/anthropic-redesigning-source-control.md`
- **Summary:** Anthropic's merged changes grew from about 2,500/day (May 2026) to over 30,000/day (September). To keep up, a team of seven built Scion, a centralized, server-side VCS, plus a review tool (Antique), code search and source-control IAM, and migrated the monorepo off git in five months. For Fervo, the relevant parts are the "lessons" section. Reviewers check *intent* rather than every line. Approval rules distinguish kinds of change. Adversarial LLM review tends to over-engineer. A proper merge queue doesn't fit agent scale, so they rely on post-merge testing plus automated bisect/revert. Per-component "superfan" Claudes watch telemetry. Anthropic says Scion is not a general git replacement and will not be offered publicly. Instead it asks git forges to adopt the ideas, and it says it wants to "partner with GitHub, GitLab, and the OSS community".
- **Key quotes:**
  - "At Anthropic, coding is no longer the bottleneck to building systems or doing research."
  - "The bottleneck, now, is all of the developer infrastructure built for human scale: source control, builds, and CI."
  - "In May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day."
  - "In order to support this growth, we built Scion, an in-house version control system, and fully migrated our monorepo from git in five months."
  - "The history of our main branch alone is almost 100 GB, and a *compressed* working copy is over 25 GB."
  - "Many internal tools, such as our automated bisect and revert pipelines, wouldn’t be practical at scale without this cheap, programmatic access to source control."
  - "Anthropic also makes extensive use of adversarial review, and, while this is incredibly effective in many ways, it can also be myopic, so skilled engineers needed to steer Claude away from over-engineering parts of the system in response to hypothetical concerns."
  - "Our team members still review every change request for the system, but they now examine the *intent* of the change as opposed to reading every line of code."
  - "the code review tooling we built can express complex semantic constraints on approvals, which lets us differentiate simple things like comment-only changes from sensitive logical changes, so that human reviewers can focus on the most consequential changes."
  - "we created Slack channels where we tasked Claude with being obsessively focused on the health of a single component. We call these Claudes “superfans.” We have a scion-daemon superfan, a scion-cache superfan, an Antique merge queue superfan, and so on. They have access to our telemetry and logs, and act like an experienced engineer who has nothing better to do than to refresh charts and look for anything strange."
  - "A proper merge queue, for example, doesn’t make much sense at agent scale. What does CI even mean when hundreds or even thousands of changes can merge while tests are running?"
  - "we’ve invested in post-merge and pre-deploy automated testing. This does mean that concurrent changes can conflict, but Claude can typically fix these conflicts faster than humans can even identify them."
  - "Scion is by no means a suitable replacement for git for general use."
  - "Very often, we found that the role of the engineers was to tell Claude “no.”"

## 2. Anthropic's Scion: related material

There is no public repo, paper or PDF for Scion. Section 1 is the only primary source. The article says: "it’s difficult to offer Scion in a form that would be broadly useful to other organizations." I also checked:

### 2a. The Register: "Anthropic reinvents source control as Claude floods the world with code" (secondary)

- **Author / date:** Thomas Claburn, The Register, "Published tue 13 Oct 2026 // 23:37 UTC".
- **URL:** https://www.theregister.com/devops/2026/10/13/anthropic-reinvents-source-control-as-claude-floods-the-world-with-code/5302943 (reached from https://www.theregister.com/a/5302943)
- **Checked:** fetched on 2026-10-21.
- **Local copy:** `articles/theregister-anthropic-scion.md`
- **Summary:** It restates the Anthropic post, compares Scion to Subversion and to Google's Piper, and notes there will be no open-source release. Its main use to Fervo is a link to GitHub's own April 2026 post, which blames availability problems on agent-driven PR growth (2b).
- **Key quotes:** "Microsoft's GitHub in April published a blog post attributing recent availability problems to the exponential growth in pull requests and commits." / "Anthropic says its bespoke system isn't right for general use. There will be no open source release."

### 2b. GitHub: "An update on GitHub availability"

- **Author / date:** Vlad Fedorov, GitHub Blog, April 28, 2026.
- **URL:** https://github.blog/news-insights/company-news/an-update-on-github-availability/
- **Checked:** fetched on 2026-10-21.
- **Local copy:** `articles/github-availability-update-2026-04.md`
- **Summary:** GitHub says agentic workflows have driven PR, commit and API growth to the point that it now designs for 30x its current scale. It describes a merge-queue bug on April 23 that silently reverted earlier PRs in 658 repos. This is direct, first-party evidence for the PRD's "it doesn't scale" claim, which the PRD does not currently cite.
- **Key quotes:**
  - "By February 2026, it was clear that we needed to design for a future that requires 30X today’s scale."
  - "Since the second half of December 2025, agentic development workflows have accelerated sharply."
  - "Pull requests merged through merge queue using the squash merge method produced incorrect merge commits when a merge group contained more than one pull request. In affected cases, changes from previously merged pull requests and prior commits were inadvertently reverted by subsequent merges."
  - "During the impact window, 658 repositories and 2,092 pull requests were affected."

## 3. GitHive (nuandy/githive, githive.app)

- **Author / org:** GitHub user `nuandy`, whose profile name is "Andy Nu" and whose profile links githive.app (GitHub API, 2026-10-21).
- **Date:** repo created 2026-10-02, last push 2026-10-21 (GitHub API). MIT licence. 2 stars and 0 forks on 2026-10-21. Written in TypeScript.
- **URLs:** https://github.com/nuandy/githive · https://githive.app · https://docs.githive.app
- **Checked:** fetched on 2026-10-21: the GitHub API metadata, the raw README, `docs/design.md`, and docs.githive.app pages (how-it-works, concepts, known-gaps, running/deploy, running/data-and-security, reference/github, reference/mcp-tools). githive.app itself is a JavaScript single-page app; its HTML only has the title "GitHive", so I read the docs instead.
- **Local copies:** `articles/githive-readme.md`, `articles/githive-design.md` (full design doc), `articles/githive-docs.md`
- **Summary:** GitHive is a Cloudflare-Workers platform with no coordinator. Agents claim paths, and an overlapping claim is refused. Agents build in their own forks, get reviewed by other agents with evidence, and land in tested batches without a queue. Every claim, vote and merge is a signed record in git that an audit can replay. It offers GitHub import and mirroring, an MCP server, a CLI and a dashboard. Cloudflare's "Clef" decision models attach *hints* to text agents write for each other: possible duplicates (`similar`), missing dependencies, thin review evidence, and prompt-injection-like "steering". Several PRD statements about GitHive are partly wrong (see the claims table). GitHive can be deployed to your own Cloudflare account. Its hosted builders and reviewers run on each person's **own** model and API key. A repo can require independent review. Approvals count once per *person*, which is close to, but not the same as, Fervo's per-*provider* rule. Its design doc has no frontier, scoring, metric or leaderboard concept (searched `design.md` for frontier/score/metric/leaderboard: no matches).
- **Key quotes:**
  - "A hive for coding agents: no queen assigns the work, each agent claims its own work, and every step is recorded in Git." (README)
  - "Each agent picks its own work and claims the files it will touch, and a claim that overlaps another is refused." (README)
  - "Another agent checks out the exact commit, runs the tests and votes with evidence: another of the repo's agents, or, when no other agent may review it, the change's own agent in a fresh context. A repo can ask for independent review, so only others' approvals count." (README)
  - "Approved changes don't wait in a line. They land as a batch: tested once together if the repo has tests to run, then pushed to main in one push." (README)
  - "**A person and their agents count as one**: between them they approve once." (design.md §11)
  - "**Independent review.** A repo, or a branch rule, that asks for it (`settings` `independent: true`) counts only others' approvals." (design.md §11)
  - "Each is a model agent in its own container, on the model and API key of the person who started it (its payer)." … "Demo runs and Access operators run on GitHive's own model, gpt-6-luna." (design.md §16)
  - "`similar` | a new claim or piece may duplicate an open change or piece, even on other paths" (design.md §17, Clef hints table)
  - "Deploy all of GitHive to your own Cloudflare account." (docs: Deploy your own)
  - "Clef, which reads what agents write for each other, needs no secret: the AI binding in the wrangler config is Workers AI on your account, billed per input token." (docs: Deploy your own)
  - "Changes that merge cleanly but break together. … None of them catches two changes that are each right alone and wrong together in what they do … unless a check exercises them together." (docs: Known gaps)

## 4. Karpathy's AgentHub: the X post, the repo and its forks

### 4a. The original repo: github.com/karpathy/agenthub

- **Checked:** GitHub API on 2026-10-21: `404 Not Found`. The repo is no longer public. Ry Walker's profile (4d) says Karpathy took it private within days of launch.
- **What it looked like:** Yuchen Jin's 2026-03-10 post includes a screenshot of the live repo (https://pbs.twimg.com/media/HDEdW-uaMAMmxVs.jpg, viewed 2026-10-21). It shows `karpathy/agenthub` (Public) with 6 commits, 1.7k stars, 113 forks, and contributors "karpathy" and "claude". The About text reads: "GitHub is for humans. AgentHub is for agents. First use case is for autoresearch but it's a lot more general than that. Exploratory project."

### 4b. The README, from the surviving copies

- **Copies:** https://github.com/ottogin/agenthub ("Fork of Karpathy's agenthub", created 2026-03-11, 162 stars, 188 forks) and https://github.com/ygivenx/agenthub (created 2026-03-09, 156 stars, 265 forks, with the original About text). The two READMEs are byte-identical apart from trailing whitespace. Neither repo has a LICENSE file (the API licence field is null and `LICENSE` returns 404), although the README ends with "## License MIT".
- **Other forks:** forks of ottogin/agenthub include alirezarezvani/agenthub (31 stars), and forks of ygivenx include miolini/agenthub (5 stars). All are 2026-03 copies with no new work that I could see. I found no fork that adds scores or claims.
- **Checked:** fetched on 2026-10-21 (GitHub API plus raw README).
- **Local copy:** `articles/agenthub-readme-ottogin-fork.md`
- **Summary:** AgentHub is one Go server, one SQLite database and one bare git repo. Agents push git bundles into a branchless commit DAG and coordinate on a message board. It has no main branch, no PRs, no merges, no scores and no claims. Note that its CLI already uses the word "frontier", for leaf commits.
- **Key quotes:**
  - "Agent-first collaboration platform. A bare git repo + message board, designed for swarms of AI agents working on the same codebase."
  - "Think of it as a stripped-down GitHub where there's no main branch, no PRs, no merges — just a sprawling DAG of commits going in every direction, with a message board for agents to coordinate."
  - "The platform is generic: it doesn't know or care what the agents are optimizing."
  - "`ah leaves                      # frontier commits (no children)`"
  - "> **Work in progress.** Just a sketch. Thinking..."

### 4c. Karpathy's X posts

- **Checked:** fetched on 2026-10-21 through the fxtwitter JSON mirror (`api.fxtwitter.com/status/<id>`), not x.com directly.
- **Local copy:** `articles/karpathy-x-posts.md`
- **Not found:** I could not find an X post **by @karpathy announcing AgentHub**. Three extended searches returned only third-party posts from 2026-03-10: @Yuchenj_UW https://x.com/Yuchenj_UW/status/2031438602383798514, @RoundtableSpace https://x.com/RoundtableSpace/status/2031418555657253253 (links github.com/karpathy/agenthub), and @OliverMolander (search result only, not fetched). He may never have tweeted it, or the post may be deleted. I can't tell which. The closest primary post is his 2026-03-08 "SETI@home" post, which sets out the AgentHub idea and which autoresearch-at-home cites:
  - https://x.com/karpathy/status/2030705271627284816 (Sun Mar 08 2026): "The next step for autoresearch is that it has to be asynchronously massively collaborative for agents (think: SETI@home style). The goal is not to emulate a single PhD student, it's to emulate a research community of them." … "Git(Hub) is *almost* but not really suited for this. It has a softly built in assumption of one \"master\" branch, which temporarily forks off into PRs just to merge back a bit later." … "You'd just want to \"adopt\" and accumulate branches of commits." … "Existing abstractions will accumulate stress as intelligence, attention and tenacity cease to be bottlenecks."
  - https://x.com/karpathy/status/2031135152349524125 (Mon Mar 09 2026): "You spin up a swarm of agents, you have them collaborate to tune smaller models, you promote the most promising ideas to increasingly larger scales, and humans (optionally) contribute on the edges." … "*any* metric you care about that is reasonably efficient to evaluate … can be autoresearched by an agent swarm."
  - Also saved: the autoresearch release post https://x.com/karpathy/status/2030371219518931079 (Mar 07 2026) and the earlier nanochat post https://x.com/karpathy/status/2029701092347630069 (Mar 05 2026).

### 4d. Ry Walker, "AgentHub (Karpathy)" (secondary)

- **URL:** https://rywalker.com/research/agenthub. Fetched on 2026-10-21. It carries a "Status update (June 2026)".
- **Local copy:** `articles/rywalker-agenthub-profile.md`
- **Summary / quotes:** "Karpathy took the AgentHub repo private within days of launch — github.com/karpathy/agenthub returns 404 with no redirect". It also reports "2,000+ stars in under 24 hours at launch" and that "the Hacker News submission drew only 5 points". It is the only source I found for *why* the repo is gone, so treat that part as unconfirmed. The 404 itself I confirmed.

## 5. Karpathy's autoresearch and autoresearch-at-home

### 5a. karpathy/autoresearch

- **URL:** https://github.com/karpathy/autoresearch
- **Checked:** GitHub API plus raw README, 2026-10-21. **98,301 stars, 13,607 forks.** Created 2026-03-06, last push 2026-03-26. Description: "AI agents running research on single-GPU nanochat training automatically".
- **Local copy:** `articles/autoresearch-readme.md`
- **Summary:** A single agent edits `train.py`, trains for 5 minutes, keeps or discards the change by `val_bpb`, and repeats on a feature branch. The human edits `program.md`. This is the single-agent loop that AgentHub and autoresearch-at-home try to parallelise, and the "metric with a fixed budget" setup that Fervo's frontier generalises.
- **Key quotes:** "give an AI agent a small but real LLM training setup and let it experiment autonomously overnight. It modifies the code, trains for 5 minutes, checks if the result improved, keeps or discards, and repeats." / "The metric is **val_bpb** (validation bits per byte) — lower is better".

### 5b. autoresearch-at-home (mutable-state-inc)

- **URL:** https://github.com/mutable-state-inc/autoresearch-at-home (a GitHub fork of karpathy/autoresearch). The join page it names is https://www.ensue-network.ai/autoresearch (not fetched).
- **Checked:** GitHub API plus raw README, 2026-10-21. 495 stars, 29 forks. Created 2026-03-10, last push 2026-03-13. Ry Walker's profile (https://rywalker.com/research/autoresearch-at-home, fetched) calls it dormant since launch week.
- **Local copies:** `articles/autoresearch-at-home-readme.md`, `articles/rywalker-autoresearch-at-home-profile.md`
- **Summary:** A "SETI@home-style" fork in which agents on different GPUs coordinate through Ensue shared memory. It already has **experiment claiming with semantic dedup and expiry, publication of every result including failures, a global best and a leaderboard, and hypothesis exchange**. That is close to Fervo's claims, "directions already tried" memory and ranked frontier, though only for one metric, with no noise model, no independent evaluation and no merge policy. The project's own write-up, quoted by Ry Walker, reports a 3.2% improvement from 20+ agents running 1,000+ experiments in 54 hours. I did not verify that figure independently.
- **Key quotes:** "**Experiment claiming** — agents claim work before starting to prevent duplicates, with semantic similarity checking and automatic expiry" / "**Result sharing** — every experiment (success or failure) is published with full `train.py` source so any result can be reproduced" / "**Global best tracking** — the swarm maintains a shared best config that agents periodically pull and adopt" / "All coordination happens through [Ensue](https://ensue-network.ai) shared memory. Git stays local."

## 6. pi, the minimal coding agent (Mario Zechner)

### 6a. Blog post: "What I learned building an opinionated and minimal coding agent"

- **Author / date:** Mario Zechner, 2025-11-30.
- **URL:** https://mariozechner.at/posts/2025-11-30-pi-coding-agent/
- **Checked:** fetched on 2026-10-21 (full text).
- **Local copy:** `articles/pi-zechner-minimal-coding-agent-blog.md`
- **Summary:** Zechner explains pi's minimalism. It has four tools (read, write, edit, bash). The system prompt and tool definitions together come in under 1,000 tokens. It is "YOLO by default", and it deliberately has no MCP, sub-agents, plan mode, built-in to-dos or background bash. Users extend it instead. This is the "small core with good defaults, everything else is an add-on" model the PRD borrows.
- **Key quotes:** "My philosophy in all of this was: if I don't need it, it won't be built. And I don't need a lot of things." / "As it turns out, these four tools are all you need for an effective coding agent." / "pi's system prompt and tool definitions together come in below 1000 tokens." / "pi does not and will not support MCP." / "Headless operation via JSON streaming and RPC mode"

### 6b. Repo and site

- **URL:** https://github.com/earendil-works/pi. `api.github.com/repos/badlogic/pi-mono` now 301-redirects there. **116,910 stars** on 2026-10-21. Site: https://pi.dev, whose footer reads "Earendil Inc." and whose banner reads "We've shipped Pi 1.0 with Pi Durable".
- **Checked:** fetched on 2026-10-21 (README, `packages/coding-agent/README.md`, `packages/coding-agent/docs/cli.md`).
- **Local copies:** `articles/pi-readme.md`, `articles/harnesses-headless-modes.md`
- **Key quotes:** "Pi is a minimal, extensible agent harness that you can make your own." / "Use Pi interactively, automate it in print or JSON mode, control it over RPC, or build apps with the Pi TypeScript SDK. See OpenClaw for a real-world integration."
- **Headless:** yes. `pi -p/--print`, `--mode json` (JSONL events) and `--mode rpc` (JSONL over stdin/stdout).

## 7. Anthropic Frontier Red Team: "Patterns and problems in emerging multiagent systems"

- **Org / date:** Anthropic, Frontier Red Team team page, published Aug 13, 2026.
- **URL:** https://www.anthropic.com/research/multiagent-systems
- **Checked:** fetched on 2026-10-21 (full text). This is the original behind the secondary coverage (unite.ai, nerdleveltech and others, which appeared in search results and were not used).
- **Local copy:** `articles/anthropic-multiagent-systems-red-team.md`
- **Summary:** In a "build a game" experiment, swarms of 10–80 agents each had a VM, a shared forum and a self-hosted repo. Older models opened many PRs that conflicted and were abandoned. Newer models (Opus 4.8, Mythos Preview) avoided conflict mainly by siloing into their own files. Only Sonnet 5 combined code sharing with a high merge rate. Same-model agents are "low variance": in an early run, 18 of 30 agents picked the same branch name. The authors note that agents in the wild will vary more, because their contexts differ and they "won’t all be Claudes". That supports Fervo counting reviews per provider (correlated same-model judgments) and making claims visible.
- **Key quotes:**
  - "In an early version of the “build a game” experiment in which agents built upon the same model all came online at the same time, 18 out of 30 agents decided to create a git branch with the exact same branch name, “mvp-game-loop.”"
  - "Individual agents are “low variance”: they often act the same in situations where different people might take a much more diverse range of actions." … "when one agent makes a bad decision, it is likely that many agents will make that same bad decision."
  - "the PRs often conflicted with one-another, at which point they were then abandoned. More recent models (in particular, Opus 4.8 and Mythos Preview) have “solved” this problem, but only by hardly working together at all"
  - "Though the end product was consistently poor, the different model generations we tested … coordinated in strikingly different ways."
  - "They also, presumably, won’t all be Claudes."

## 8. GitHub Copilot coding agent and GitHub Agent HQ

### 8a. "GitHub Copilot: Meet the new coding agent"

- **Author / date:** Thomas Dohmke, GitHub Blog, May 19, 2025 (updated May 23, 2025).
- **URL:** https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/
- **Checked:** fetched on 2026-10-21.
- **Local copy:** `articles/github-copilot-coding-agent-announcement.md`
- **Summary:** You assign an issue to Copilot. It runs in GitHub Actions, pushes to a draft PR and requests human review. By default it can only push to its own branches, and the person who asked for the PR cannot approve it. This supports "fitted into the human PR loop". GitHub already enforces a form of no-self-approval.
- **Key quotes:** "Just assign a task or issue to Copilot. It runs in the background with GitHub Actions and submits its work as a pull request." / "The agent can only push to branches it created" / "The developer who asks the agent to open a pull request cannot be the one to approve it – so any “required reviews” rule you have set up in your repository will be honored"

### 8b. "Introducing Agent HQ: Any agent, any way you work"

- **Author / date:** Kyle Daigle, GitHub Blog, October 28, 2025 (GitHub Universe 2025).
- **URL:** https://github.blog/news-insights/company-news/welcome-home-agents/
- **Checked:** fetched on 2026-10-21.
- **Local copy:** `articles/github-agent-hq-announcement.md`
- **Summary:** Agent HQ brings third-party agents (Anthropic, OpenAI, Google, Cognition, xAI) into GitHub under a Copilot subscription. It adds "mission control", agent identity and policy, branch controls for CI on agent code, one-click conflict resolution, and a Copilot self-review step. It is explicitly built on existing PRs and issues.
- **Key quotes:** "Agents shouldn’t be bolted on. They should work the way you already work. That’s why we’re making agents native to the GitHub flow." / "You’re still working with the primitives you know—Git, pull requests, issues" / "we’ve added a code review step into the Copilot coding agent’s workflow, too, so Copilot gets an initial first-line review and addresses problems (before you even see the code)."

### 8c. Upcoming: GitHub Universe 2026

- "GitHub Universe is back: All together now, in the agentic era" (Ariel Kanter, GitHub Blog, June 4, 2026): https://github.blog/news-insights/company-news/github-universe-is-back-all-together-now-in-the-agentic-era/. I read it through a WebFetch summary only and did not save it. It dates Universe 2026 to **October 28–29, 2026** in San Francisco, one week after this check. Quote, as returned by WebFetch: "Today, that collaboration goes beyond just people, extending to tools, integrations, and agents in one unified workflow."

## 9. Harnesses named in the PRD

All were checked on 2026-10-21 against the official GitHub repo (stars from the API) and the official doc page for non-interactive use. Excerpts are in `articles/harnesses-headless-modes.md`.

| Harness | Official repo / docs | Headless / non-interactive mode |
|---|---|---|
| Claude Code (Anthropic) | https://github.com/anthropics/claude-code (152,692★) · https://code.claude.com/docs/en/headless | Yes: "Add the -p (or --print) flag to any claude command to run it non-interactively", with `--output-format` for structured output, plus Python/TS Agent SDK. |
| Codex CLI (OpenAI) | https://github.com/openai/codex (130,276★) · https://developers.openai.com/codex/noninteractive (redirects to https://learn.chatgpt.com/docs/non-interactive-mode) | Yes: "Use `codex exec` to run Codex in scripts and CI". It streams progress to stderr and prints only the final agent message to stdout. |
| OpenClaw | https://github.com/openclaw/openclaw (392,658★) · https://docs.openclaw.ai/cli/agent | Yes: "openclaw agent exec runs one embedded agent turn without connecting to a Gateway. It is the recommended headless entry point for CI and coding automation", with `--json` and `--message-file`. |
| Hermes Agent (Nous Research) | https://github.com/NousResearch/hermes-agent (255,784★) · https://hermes-agent.nousresearch.com/docs/reference/cli-commands | Yes: `hermes chat -q "…" --oneshot` ("answer the query and exit … Implied on non-TTY stdio"), a `hermes-agent --query` minimal runner, and `hermes serve` (headless backend). |
| pi | https://github.com/earendil-works/pi (116,910★) · `packages/coding-agent/docs/cli.md` | Yes: `-p/--print`, `--mode json`, `--mode rpc`. |

## 10. Virgil, *fervet opus* (Georgics 4.169; Aeneid 1.436)

- **URLs:** https://www.thelatinlibrary.com/vergil/geo4.shtml · https://www.thelatinlibrary.com/vergil/aen1.shtml · Lewis & Short s.v. *ferveo* at https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=ferveo · https://en.wiktionary.org/wiki/fervo (WebFetch summary only)
- **Checked:** fetched on 2026-10-21.
- **Local copy:** `articles/virgil-fervet-opus.md`
- **Summary:** Both citations are correct. The line "Fervet opus, redolentque thymo fragrantia mella" is Georgics 4.169, four lines after the printed "165" marker. It appears again, in lowercase, as Aeneid 1.436, the line after the "435" marker, in the simile of the Carthaginians as bees. Lewis & Short gives *fervo, 3* as the ante- and post-classical (and poetic) form of *ferveo, 2*, so "an old Latin form" holds up. Two small points. First, *fervet* in Virgil is the *ferveo* form (the *fervo* form would be *fervit*). Second, L&S glosses this passage as "glows, i. e. is carried on briskly", not "I am busy"; "seethe" and "swarm" fit sense 2 ("to be in a ferment, to swarm with numbers").
- **Key quotes:** "fervĕo , bŭi, 2, or fervo , vi, 3 (the latter form ante-and post-class., …; poet. in class. per., …)" / "fervet opus redolentque thymo fragrantia mella, glows, i. e. is carried on briskly, Verg. G. 4, 169" (L&S)

## 11. Name check (PRD "Name note"): quick re-check

On 2026-10-21 these returned 404: `registry.npmjs.org/fervo`, `pypi.org/pypi/fervo/json`, `crates.io/api/v1/crates/fervo`, `formulae.brew.sh/api/formula/fervo.json`, `formulae.brew.sh/api/cask/fervo.json`. `whois fervo.sh` returned "Domain not found." `api.github.com/users/fervo` is an Organization named "Fervo AB" (created 2011-06-29, 54 public repos). Its recent repos are PHP/Symfony bundles (AdvisoryLocker, ReleasePhaseMigrationsBundle, EnumBundle and others). I did not re-check SwarmHub, AgentHill, the .com/.ai/.io domains or Fervo Energy.

---

## Claims in the PRD checked

| # | PRD claim | Verdict | Evidence |
|---|---|---|---|
| 1 | "In October 2026 Anthropic wrote that 'the bottleneck, now, is all of the developer infrastructure built for human scale'" | **Correct** | Published Oct 13, 2026. Verbatim: "The bottleneck, now, is all of the developer infrastructure built for human scale: source control, builds, and CI." (§1) |
| 2 | "merged changes per day grew from about 2,500 to over 30,000 in four months" | **Correct** | "In May 2026, Anthropic averaged around 2,500 code changes merged per day; as of September, we merged over 30,000 per day." May to September is four months. (§1) |
| 3 | "it replaced git internally to keep up" | **Correct** | "we built Scion, an in-house version control system, and fully migrated our monorepo from git in five months." (§1) |
| 4 | Claude fixes conflicts "faster than humans can detect them" (in quotation marks) | **Incorrect wording** (meaning correct) | Actual: "Claude can typically fix these conflicts faster than humans can even identify them." The context is concurrent changes that conflict *after* merge, under post-merge testing. Fix the quote. (§1) |
| 5 | Anthropic found that a merge queue "doesn't fit agent scale" (in quotation marks) | **Incorrect wording** (meaning correct) | Actual: "A proper merge queue, for example, doesn’t make much sense at agent scale." Note that Anthropic still runs an "Antique merge queue" (it has a superfan). What it dropped is a "global repository lock on the merge queue". (§1) |
| 6 | `merge_then_verify` with automatic revert "is how Anthropic handles agent-scale volume" | **Correct, slightly over-stated** | "we’ve invested in post-merge and pre-deploy automated testing", plus "our automated bisect and revert pipelines". The article does not say every change lands unverified. (§1) |
| 7 | Long-lived reviewer agent per component "after the 'superfan' Claude instances Anthropic assigns to one component each" | **Partly correct** | One Claude per component is right. But superfans *monitor health* ("access to our telemetry and logs … refresh charts and look for anything strange"). They are not code reviewers. Say "inspired by" rather than implying they review. (§1) |
| 8 | "A human reviews intent … not every line, as Anthropic's reviewers do" | **Correct** (with context) | "they now examine the *intent* of the change as opposed to reading every line of code". This is the Scion team about its own system, and they "still review every change request". (§1) |
| 9 | Approval rules by kind of change; judge penalises over-engineering (from Anthropic) | **Correct** | "differentiate simple things like comment-only changes from sensitive logical changes"; adversarial review "can also be myopic … over-engineering". (§1) |
| 10 | Scion "rebuilds storage and fetch for a 100 GB monorepo. Its authors say it is not a general git replacement." | **Correct** | "The history of our main branch alone is almost 100 GB"; "Scion is by no means a suitable replacement for git for general use." Scion also moves commits, merges and rebases to the server, so it is more than storage and fetch. (§1) |
| 11 | Red-team write-up: "most of 30 agents converging on the same branch name" (marked as still to check) | **Correct** (now checked against the original) | Original: Anthropic Frontier Red Team, "Patterns and problems in emerging multiagent systems", 2026-08-13: "18 out of 30 agents decided to create a git branch with the exact same branch name, “mvp-game-loop.”" Caveats to add: it was "an early version" of the experiment, with all agents on the same model and coming online at the same time. Cite the original and drop "from secondary coverage". (§7) |
| 12 | GitHub's Copilot coding agent and Agent HQ "are fitted into the human PR loop" | **Correct** | Copilot "submits its work as a pull request" and tags a human for review. Agent HQ: "You’re still working with the primitives you know—Git, pull requests, issues". (§8) |
| 13 | GitHub "doesn't scale" for agent swarms | **Supported** (new evidence, not in the PRD) | GitHub itself (2026-04-28): planning for "30X today’s scale" because "agentic development workflows have accelerated sharply", and a merge-queue bug that reverted work in 658 repos. (§2b) |
| 14 | GitHive is "githive.app, MIT, October 2026" | **Correct** | Repo created 2026-10-02, MIT licence (GitHub API). (§3) |
| 15 | GitHive "ships path claims that refuse overlaps, agent review, policy-gated batch merges, signed records in git, GitHub import, an MCP server and a dashboard" | **Correct** | All in the README and docs. It also has a CLI, GitHub mirroring/PR export, and Clef hints that flag likely duplicate claims (`similar`) and prompt-injection "steering". (§3) |
| 16 | GitHive "has no notion of a frontier" | **Correct** | No frontier, score, metric or leaderboard concept in `docs/design.md`. Coordination covers claims, review and landing only. (§3) |
| 17 | GitHive "runs its own models on its servers" | **Mostly incorrect** | GitHive can be deployed to "your own Cloudflare account". Its hosted builders and reviewers run "on the model and API key of the person who started it". Agents connected over MCP bring their own model. Only Clef (Workers AI, on the deploying account) and demo runs ("GitHive's own model, gpt-6-luna") use GitHive-side models. The accurate contrast: GitHive *holds* users' keys server-side (sealed in D1) and runs LLM calls in its Worker or containers. Fervo keeps keys and every LLM call in the operator's local runner. (§3) |
| 18 | GitHive "lets an author's agent review its own change 'in a fresh context'" | **Correct but incomplete** | That is the fallback when no other reviewer is available. But "A repo can ask for independent review, so only others' approvals count", and "A person and their agents count as one" for approvals. Fervo's real difference is counting by *provider* and never letting self-review count. (§3) |
| 19 | "Karpathy's AgentHub and its forks are a git DAG plus a message board, with no scores and no claims" | **Correct** (with caveats) | README: "a sprawling DAG of commits … with a message board". It has no scores and no claims. Caveats: the original repo `karpathy/agenthub` now returns 404, so cite a fork. AgentHub's CLI already calls leaf commits "frontier commits", so Fervo's use of "frontier" should say it means a *scored* frontier. (§4) |
| 20 | autoresearch: "about 98k GitHub stars as of 2026-10-21" | **Correct** | 98,301 stars (GitHub API, 2026-10-21). Note: stars measure attention, not active operators. The repo has had no pushes since 2026-03-26. (§5a) |
| 21 | autoresearch-at-home cited as prior art (implicitly lacking Fervo's features) | **Correct to cite; it overlaps more than the PRD says** | It already has claims with semantic dedup and expiry, shared results including failures (memory of tried directions), a global best and a leaderboard. It lacks noise-aware promotion, independent evaluation, a judge and merge policy. It has been dormant since 2026-03-13. (§5b) |
| 22 | "a minimal harness like pi" (four tools and a short prompt) | **Correct** | "these four tools are all you need"; "system prompt and tool definitions together come in below 1000 tokens"; "Pi is a minimal, extensible agent harness". The repo moved to `earendil-works/pi`. (§6) |
| 23 | Harnesses (Claude Code, Codex, pi, OpenClaw, Hermes) have headless modes Fervo can reuse | **Correct** | `claude -p`, `codex exec`, `pi --print/--mode json/rpc`, `openclaw agent exec`, `hermes chat -q --oneshot` / `hermes-agent --query`. (§9) |
| 24 | Virgil's *fervet opus* (Georgics 4.169, Aeneid 1.436) describes bees at work | **Correct** | Both line numbers verified on The Latin Library. In the Aeneid it is a simile comparing the Carthaginians to bees. (§10) |
| 25 | "Fervo, an old Latin form of *ferveo* ('I seethe, I am busy')" | **Correct, gloss loose** | L&S: "fervo, vi, 3 (the latter form ante-and post-class. …; poet. …)". The L&S meaning is "to boil, glow", with a figurative sense "to be in a ferment, to swarm", and for G. 4.169 "is carried on briskly". "I am busy" is a free paraphrase. (§10) |
| 26 | Name note: `fervo` free on npm, PyPI, crates.io, Homebrew; fervo.sh unregistered; GitHub `fervo` is an older Symfony-bundle publisher | **Correct** (2026-10-21) | All registry lookups returned 404, and whois for fervo.sh says "Domain not found." GitHub `fervo` = "Fervo AB" org (2011), with Symfony/PHP bundles. (§11) |
| 27 | Other name-note items (SwarmHub / Red Bull Basement, swarmhub npm, domains, AgentHill, Fervo Energy) | **Could not check** (not attempted) | Out of scope for this pass. |
