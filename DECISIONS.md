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

## Session enrollment (branch `feat/session-enrollment`)

- 2026-10-28. A human clone never stores the human token. It stores an `enroller` token, which can only create agent actors owned by that human. Before this, a Claude Code session in a human clone held full human powers and could review and merge its own nodes.
- 2026-10-28. One actor per harness session, id `<owner>-<12 session characters>`, created by a Claude Code SessionStart hook that `fervo clone` writes to `.claude/settings.local.json`. A per-clone actor would fix the privilege hole but not idempotency-key collisions or per-session attribution for the study.
- 2026-10-28. The token reaches the session through `$CLAUDE_ENV_FILE` as `FERVO_TOKEN`, which takes precedence over `.git/config` in every command. `submit` pushes with it, replacing the clone's header, so the branch prefix comes from `/whoami` and the claim response carries `branch`. `fervo.prefix` is gone.
- 2026-10-28. Provider and harness are fixed per clone, not reported by the session, so a session cannot choose the provider of its own judge. `model` comes from the hook and is informative only.
- 2026-10-28. Human powers in a session need a grant (`fervo delegate`), valid 12 hours and reusable within that time, so compaction and `/clear` re-enroll without a new prompt. A session's kind never changes.
- 2026-10-28. Re-enrolling a session rotates its token instead of replaying a stored one. Responses stored for idempotent replay have `token` and `grant` nulled, so the database holds only hashes. A replayed `actor add` therefore returns `token: null`.

## Working trees (branch `feat/separate-working-trees`)

- 2026-10-28. `claim --checkout` creates a Git worktree per lease at `<clone>/.fervo/worktrees/<lease>` instead of switching the clone's branch. A shared working tree let two agents in one folder move each other's HEAD and index. This belongs in Fervo, not in the harness: Fervo owns the lease-to-branch mapping and `--checkout`, and `claude --worktree` is opt-in, specific to Claude Code, and starts from local HEAD instead of the claim's parent.
- 2026-10-28. The worktree starts at the claim's `parent_commit`, not `FETCH_HEAD`, because concurrent fetches in one clone overwrite `FETCH_HEAD`.
- 2026-10-28. Fervo does not delete worktrees. An agent may still be inside one, and a rebase cherry-picks from the old lease branch. The skill tells agents to run `git worktree remove` when their node stops.

## Review fixes (branch `feat/cli-mvp-ext`)

- 2026-10-28. When postmerge tests fail on a node that `main` has already moved past, the server leaves `main` alone, keeps the node `merged`, records a reason asking for a manual revert, and emits `postmerge_failed`. Reverting automatically would discard every later node, and the compare-and-swap revert used to throw, roll back the result transaction, and crash the runner.
- 2026-10-28. A submit rejected on the server (pinned path, non-descendant commit) returns `job: null`. It used to queue a review job and mark it done unrun, which left a phantom job in the log.

- 2026-10-28. A review job that fails to run (runner error, lease attempts exhausted) leaves the node `verified` with `next_action: retry` and a `reason` of `review unavailable: <error>` or `review lease attempts exhausted`; `fervo retry` clears the reason and lets `policy()` queue a new review, which now ignores failed jobs when it checks whether one exists. The alternative, moving the node to `failed` so the existing retry path applies, would re-run the whole evaluation to recover from a reviewer outage and would drop a scored node off the frontier in the meantime.

## Package, runner, and study decisions

- 2026-10-27. TypeScript on Node.js 24 LTS for the package, CLI, server, runner, and tests. Migrate the existing Python CLI prototype rather than maintaining two implementations.
- 2026-10-27. The first MVP is the end-to-end CLI repo-manager loop; the comparative study is later and its baseline arm remains undecided. Filippo leads the package/CLI work and Roshan leads tests, agents and study setup for Assignment 6; both work across tracks.
- 2026-10-27. The runner writes claim and pre-merge review verdicts. Runner review stages can be configured from one basic check to a richer workflow. Claude Opus is a possible reviewer model.
- 2026-10-27. When `main` or a parent branch moves, the agent rebases and resubmits under a new claim and lease, with `supersedes` linking to the prior node.
- 2026-10-27. Three paired node/parent samples and five baseline runs are defaults. Promotion uses the interval on paired gain, not two non-overlapping intervals.
- 2026-10-27. The judge compares node and parent in both orders and comes from a provider other than the author's. Active judge templates and held-out inputs stay with the runner, outside the published package and agent clones.
- 2026-10-27. Tried labels expire from agent context after a configurable TTL, seven days by default; the underlying nodes and events remain in history.
- 2026-10-27. Study agents are two Claude Code agents, one Codex agent and pi using a cheaply hosted model. Roshan chooses and initializes the study target repo.
