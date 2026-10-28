# Decisions

One dated line per choice that changes `dev_docs/03-fervo-engineering-plan.md`. Where the plan and the report (`dev_docs/02-fervo-report.md`) disagree, the latest explicit decision wins.

## CLI (branch `feat/cli-mvp`)

- 2026-10-27. Every command prints JSON, always; indented when stdout is a terminal, one line otherwise. There is no `--json` flag. An agent that forgets a flag gets text it parses badly, and two output formats are two code paths to keep in sync.
- 2026-10-27. `--key` is required on every command that writes. An optional key is a key an agent forgets, and a forgotten key is what makes a retry after a crash unsafe. The key travels in the `Idempotency-Key` HTTP header; the server hashes the body.
- 2026-10-27. No `fervo credential` helper. `fervo clone` writes `http.<git_url>.extraHeader = Authorization: Bearer <token>` into `.git/config` (never the working tree), so plain `git fetch` and `git push` authenticate without a helper process or a 401 round trip. The token lives in one place, and the CLI reads it from there.
- 2026-10-27. `GET /whoami` returns the actor and the git URL. The server decides where git lives (smart HTTP, the SSH fallback, or `file://` for a one-laptop demo) and the CLI never hard-codes `/git/repo.git`.
- 2026-10-27. `fervo claim` returns `blocked` (the pinned paths inside the declared scope) next to `overlaps`, as in the report's example. Neither refuses the claim.
- 2026-10-27. Node status follows the report: `delta` and `interval` are the paired gain over the parent, plus `rank` on the frontier. Absolute `score_mean/lo/hi` stays a server-side detail.
- 2026-10-27. `abandon`, `veto`, `merge` and `revert` require `--reason`. The report's override must "leave a trace", and a tried direction without a reason teaches the next agent nothing.
- 2026-10-27. `fervo merge` has no `--force`: a human merge is always the override. A human who wants the policy to decide writes `fervo review --pass`.
- 2026-10-27. `fervo frontier` is dropped. `fervo context` already returns the frontier, and a second command for a slice of the same query is surface without a user.
- 2026-10-27. Server-side commands (`init`, `serve`, `hook pre-receive`, `runner`, `import`) and `skill install` are not in this branch. They belong to the repo-management and judgment work, and SKILL.md should describe behaviour that exists.

## Package, runner, and study decisions

- 2026-10-27. TypeScript on Node.js 24 LTS for the package, CLI, server, runner, and tests. Migrate the existing Python CLI prototype rather than maintaining two implementations.
- 2026-10-27. The first MVP is the end-to-end CLI repo-manager loop; the comparative study is later and its baseline arm remains undecided. Filippo leads the package/CLI work and Roshan leads tests, agents and study setup for Assignment 6; both work across tracks.
- 2026-10-27. The runner writes claim and pre-merge review verdicts. Runner review stages can be configured from one basic check to a richer workflow. Claude Opus is a possible reviewer model.
- 2026-10-27. When `main` or a parent branch moves, the agent rebases and resubmits under a new claim and lease, with `supersedes` linking to the prior node.
- 2026-10-27. Three paired node/parent samples and five baseline runs are defaults. Promotion uses the interval on paired gain, not two non-overlapping intervals.
- 2026-10-27. The judge compares node and parent in both orders and comes from a provider other than the author's. Active judge templates and held-out inputs stay with the runner, outside the published package and agent clones.
- 2026-10-27. Tried labels expire from agent context after a configurable TTL, seven days by default; the underlying nodes and events remain in history.
- 2026-10-27. Study agents are two Claude Code agents, one Codex agent and pi using a cheaply hosted model. Roshan chooses and initializes the study target repo.
