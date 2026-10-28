# Decisions

One dated line per choice that changes `docs/03-fervo-engineering-plan.md`. Where the plan and the report (`docs/02-fervo-report.md`) disagree, the report wins unless a line here says otherwise.

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

## Flagged for the server and runner work (not decided here)

- 2026-10-27. Promotion. The plan (section 7) calls a node `improved` when its 95% interval sits above the parent's. Two non-overlapping 95% intervals is a test at roughly p < 0.006, unpaired, and it compares against a stored baseline instead of the parent run on the same machine at the same time. The report asks for paired runs of node and parent in the same job and an interval on the paired gain above zero. Recommendation: follow the report.
- 2026-10-27. Judge. The plan has one fixed model returning an absolute 0–1 score; the report asks for a pairwise comparison with the parent, in both orders, from a provider other than the author's. Recommendation: follow the report, and fix the judge model per author provider for the whole study so scores stay comparable.
- 2026-10-27. Judge secrecy. The plan ships the judge template inside the published package, where any agent can read it with `pip show -f fervo`. The report says agents see what is scored but not how, and that held-out inputs live with the runner. Recommendation: templates and held-out inputs are runner configuration, hashed into verdicts, and not in the wheel.
- 2026-10-27. Tried labels expire (report); the plan lists every node forever. The contract carries `at` on each tried entry so the server can apply an expiry rule; the rule itself is open.
- 2026-10-27. Resubmission after `needs_rebase`. The plan says the new node `supersedes` the old one but not which lease it is submitted under. Open: a new claim on `main`'s head with `supersedes` on the claim, or a resubmit on the old lease.
