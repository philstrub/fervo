# Where Fervo stands, and how to differentiate

*Synthesis of the four research passes run on 2026-10-21. For Filippo and Roshan. Every claim here is backed by one of the files linked in each section; check the source file before quoting anything in the PRD.*

## Bottom line

- **Most of the core already exists elsewhere.** Three of Fervo's five core pieces are already built by funded companies or by popular open-source projects: claims, AI review and policy-gated merge. Computed context is partly covered.
- **What is new is the scored frontier and the rules around it.** That means a noise-aware score from user metrics plus a pinned judge, a queryable memory of failed directions, and independence enforced as merge policy (no self-review, verdicts counted per provider). No product or repo we found combines these.
- **Fervo's real position is a bridge between two groups that don't overlap today.** The autoresearch tools score and verify work but never merge into an ordinary repo. The coordination tools claim and merge work but never score it. Fervo is the only design we found that does both on a general repo.
- **"Replaces GitHub" is the weakest part of the pitch.** GitHub, Cursor (Origin plus Graphite) and Entire are each spending heavily on agent-native hosting, and OpenAI reportedly is too. Fervo "hosts nothing", so calling it a GitHub replacement contradicts itself.

## 1. Already done by others: don't claim these as new

| Fervo piece | Who already does it | Source |
|---|---|---|
| Claims / declarations | GitHive (path claims that refuse overlaps), Pawsly (intent over MCP), Foremerge (advisory, semantic), MCP Agent Mail (file leases), Beads (claimable task graph, 28k★), autoresearch@home (TTL claims with semantic dedup), Claude Code agent teams (file-locked task list) | [products](landscape/products.md#24-coordination-layers-pawsly-jindo-ai-and-githive-threat-medium-high-conceptually-the-closest), [OSS](landscape/open-source-and-people.md#2a-claims-leases-and-intent-declarations-fervos-declarations) |
| Memory of tried directions | autoresearch@home, polyresearch, evo, CORAL; Karpathy's own autoresearch PR #92 | [OSS](landscape/open-source-and-people.md#differentiation-notes) |
| Independent evaluation by re-running | polyresearch ("agents cannot grade their own homework"), HF agent-collabs, CORAL's hidden grader | [OSS](landscape/open-source-and-people.md#5-repo-table) |
| Cross-model review | GitHub Rubber Duck (experimental), Entire Review, ARIS (17.8k★) | [products](landscape/products.md#21-github-copilot-coding-agent-agent-hq-copilot-app-git-rebuild-threat-high) |
| AI code review | CodeRabbit, Qodo, Greptile, Graphite Agent | [products](landscape/products.md#26-ai-code-review-coderabbit-qodo-greptile-graphite-agent-ellipsis-bito-threat-medium-commoditises-fervos-review-plugin) |
| Merge queue with batching and bisect | GitHub, Graphite, Mergify, Aviator, Trunk, GitHive, Gas Town's Refinery | [products](landscape/products.md#25-merge-queue-vendors-mergify-aviator-trunk-graphite-threat-medium) |
| Self-hosted git+SQLite remote | AgentHub itself ("One Go binary … one SQLite database, one bare git repo"), ngaut/agent-git-service | [OSS](landscape/open-source-and-people.md#2f-self-hosted-forges-and-version-control-designed-for-agents) |
| GitHub import and mirroring | Entire, GitHive, Cursor Origin | [products](landscape/products.md#1-comparison-table) |

**The warning to take seriously:** Pawsly's own benchmark found that intent declarations made four agents write *matching* code (3 of 10 tasks without them, 9 of 10 with them), but the number of *passing* tasks stayed at 6 of 10, at about 1.5× the agent steps. In their words: "Coordination made the agents agree. It did not make them right." So the demo cannot rest on claims.

## 2. Genuinely new, as far as these searches show

1. **Noise-aware promotion.**
   - It measures a baseline noise floor at `init`.
   - A node is promoted only when the evidence clears that noise.
   - Every result gets an explicit outcome: `within_noise`, `worse` or `improved`.
   - Every autoresearch derivative we found compares point estimates, and Mergify's flaky-test labelling is the nearest commercial analogue.
2. **A composite score: user metrics plus a hash-pinned judge** that sees the declared intent and penalises scope creep. CORAL uses rubric judges, but none of the tools pins the judge or weights it against metrics in a repo policy. Hugging Face's 100-agent Gemma challenge shows why a single metric isn't enough: "Agents figured out how to maintain PPL below the target value regardless of model quality."
3. **Verdicts counted per provider**, so three Claudes give one Claude verdict. We found this nowhere as a merge rule.
4. **Strict, testable independence.** Self-review never counts, and only results measured by the runner count as evidence. GitHive's default falls back to self-review "in a fresh context", although it has an `independent: true` option. Its approvals count per person, not per provider.
5. **No orchestration, no hosting, and evaluation on the operator's keys.** autoresearch@home, GitHive and HF agent-collabs are all hosted. CORAL, evo and Gas Town launch the agents themselves. polyresearch stays on GitHub.

## 3. What the literature says to change in the design

From [papers/papers.md](papers/papers.md): 40 papers, 37 with PDFs.

**What it supports:**
- **Pinned paths and held-out tests.** Agents edit tests and evaluators (ImpossibleBench, EvilGenie, SpecBench).
- **No self-review.** LLM judges prefer their own outputs, and outputs from similar models (Panickssery 2024, Goel 2025).
- **A shared claim and status layer.** In AgentRoom, that layer, not parallelism, carries the benefit.

**What to change:**
1. **Change the judge.** Make it a different provider from the node's author, or a small cross-provider panel (PoLL: a panel beats one large judge at lower cost). Sampling one judge k times averages out noise, not bias.
2. **Run the judge pairwise.** Compare child against parent in both orders, instead of giving each a pointwise score (CodeJudgeBench).
3. **Fix the statistics.** "The child's CI clears the parent's CI" is conservative and non-standard. Use a paired difference with its own interval, choose k with a power analysis, and re-run winners to correct for the winner's curse. k=3 is probably too few. Agentic runs vary by 2–6 points on SWE-bench even at temperature 0.
4. **Don't treat per-provider counting as true independence.** Errors are correlated across providers too (Kim 2025: models agree on 60% of the cases where both are wrong). Present it as a mitigation, not a guarantee.
5. **Hide the metric details and limit feedback.**
   - Exposure helps hacking: in the Darwin Gödel Machine, objective hacking was more frequent when the evaluation functions were visible. Expose metric *names* in `context`, not the scoring code or the judge prompt.
   - Feedback helps attacks: optimising against a monitor produces obfuscated hacking (Baker 2025), and adaptive comment injection guided by the detector's feedback succeeds over 90% of the time (ALIBI). Isolating or stripping comments works better than a defensive prompt.
6. **Keep stepping stones, and let "tried" expire.**
   - Pure beat-your-parent promotion collapses into hill climbing (DGM archive, MAP-Elites, FunSearch islands, tabu search). A comment on Karpathy's PR #92 makes the same point.
   - Keep `within_noise` and speculative nodes visible.
   - Let "tried" labels expire, and let a node override them when it beats the best.
7. **Soften "text conflicts are cheap".** Pairs of agent PRs from different agents conflicted 41.7% of the time, and 42% of those conflicts were structural. Field reports (Carlini, Cursor) say conflicts are easy to fix, so keep the de-emphasis, but don't claim they cost nothing.
8. **Add a third study arm: N independent agents, best of N.** Agentless and SwarmWorld suggest it. Without it, a sceptic can say Fervo only beats a badly coordinated GitHub setup.

## 4. Positioning recommendations

1. **New headline: "the frontier for agent swarms".** It decides which branch is ahead and whether it may land, on any git remote. Make leaving GitHub a consequence rather than the claim. The "pi for repo management" framing still fits; "GitHub replacement" doesn't.
2. **First user: a solo researcher or small team running 2–10 agents from different providers** on a repo with a real metric: autoresearch-style loops, performance or kernel tuning, benchmarked libraries, eval-driven prompt repos. Repos scored only by the judge are where Fervo is weakest.
3. **Lead the demo with the frontier, not claims.** Report:
   - the metric reached at equal tokens;
   - duplicated *directions* avoided;
   - wasted work stopped by `within_noise`.
4. **Own "multi-provider by default".** Single-vendor swarms get coordination bundled in (Claude Code agent teams, Cursor planners, Augment Intent, Warp Oz). Fervo's user runs Claude Code, Codex and pi side by side, and wants none of those vendors grading its own work.
5. **Make independence a public benchmark.** Publish the PRD's misuse cases as a suite: self-review, same-provider "independent" reviews, edits to the judge or benchmark, and comment injection. Show which tools pass.
6. **Integrate the commodity pieces instead of rebuilding them.** Use CodeRabbit, Qodo, Copilot review and Entire Review as *verdict producers* counted by provider, and Mergify, GitHub or Graphite queues as the *merge backend*. Fervo is then the neutral scoring layer in front of tools teams already pay for.
7. **Consider shipping a GitHub-attached mode first.** A GitHub App or Action could post `score ± ci`, `delta_vs_parent` and `within_noise` as a check. `fervo serve` then serves the self-hosting niche, which is real: SourceHut's new terms ban LLM-written content, and Forgejo bans AI contributions to Forgejo itself.
8. **Assume the incumbents will copy features.** GitHub could ship "count reviews by model family" in one changelog entry. What lasts is an open `fervo.toml` policy schema, a versioned library of judge templates, and the scoring and noise method.

## 5. Corrections to make in the PRD

Details and evidence are in the claims table in [sources/sources.md](sources/sources.md#claims-in-the-prd-checked).

- **Misquote:** "faster than humans can detect them" should be "faster than humans can **even identify** them".
- **Misquote:** "doesn't fit agent scale" should be "A proper merge queue, for example, doesn't make much sense at agent scale". Anthropic still runs a merge queue; what it dropped is the global repository lock.
- **"Superfans":** they monitor component telemetry and logs; they don't review code. Say "inspired by".
- **GitHive "runs its own models on its servers":** mostly wrong. It can be self-deployed to Cloudflare and runs users' own keys. The accurate contrast is that GitHive *stores* keys on its server, while Fervo keeps them in the operator's runner.
- **GitHive self-review:** "in a fresh context" is only a fallback. Mention its `independent: true` option and that approvals count per person.
- **The red-team figure is verified.** The original says: "18 out of 30 agents decided to create a git branch with the exact same branch name, 'mvp-game-loop.'" Source: Anthropic Frontier Red Team, *Patterns and problems in emerging multiagent systems*, 2026-08-13. Drop "from secondary coverage", and add that it was an early version of the experiment, with every agent on the same model and starting at once. (The open-source pass couldn't find this source; the primary-sources pass did.)
- **"AgentHub and its forks … no scores and no claims":** true only of AgentHub itself, whose original repo now returns 404. Its derivatives add claims, leaderboards and re-run verification. Also note that AgentHub's CLI already calls leaf commits "frontier commits", so write "*scored* frontier".
- **Prior art to cite alongside GitHive:**
  - polyresearch, the closest conceptually;
  - autoresearch@home;
  - CORAL;
  - Foremerge;
  - Pawsly, whose result that "coordination made the agents agree, not right" should be cited;
  - Entire;
  - Cursor Origin.
- **New evidence for "GitHub doesn't scale":**
  - GitHub, 2026-04-28: it is planning for "30X today's scale", and a merge-queue bug reverted work in 658 repos.
  - GitHub, 2026-10-06: it is rebuilding its git storage for "agent-scale development".
- **The "fervo" gloss:** Lewis & Short gives "to boil, glow", with a figurative "to be in a ferment, to swarm". "I am busy" is a loose paraphrase.
- **Objections to answer directly:**
  - Many people say worktrees or fewer agents are enough.
  - Mario Zechner, whose minimal-harness philosophy the PRD cites, calls parallel sub-agents "an anti-pattern".

## 6. Who to talk to (the PRD's "ask 3+ people who run agent swarms")

The full shortlist, with links, is in [the open-source and people file](landscape/open-source-and-people.md#interview-shortlist). The first picks:

1. **Jesse Heaslip:** lands about 90 agent commits a day without review and reverts automatically. The most direct test of the merge-policy assumption.
2. **Nick Woodhead** (Foremerge): runs several agents across a team on one repo, and deliberately avoids an LLM judge. The strongest challenge to the judge.
3. **Ismail Pelaseyed** (polyresearch): the open-source thinking closest to Fervo's evaluation core. A possible collaborator.
4. **Carlos Miguel Patiño and Leandro von Werra** (Hugging Face agent-collabs): ran a 100+ agent collaboration and documented metric gaming.
5. **The CORAL authors** (affiliations include MIT; check each before reaching out): the frontier, noise and judge design, on campus.
6. **Mario Zechner**, as a sceptic.

## 7. Watch list

- **GitHub Universe, 2026-10-28/29:** new agent features may land.
- **Cursor Origin:** its promised "agent-native features".
- **Entire:** native hosting and an open-sourced backend.
- **OpenAI:** whether the reported code host ships.
- **Pawsly:** how it ends up hosting.
