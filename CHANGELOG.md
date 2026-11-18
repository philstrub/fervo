# Changelog

Fervo follows [semantic versioning](https://semver.org). Before 1.0, a minor version may break the CLI, the HTTP API, the library exports or the extension API; each such break is listed under **Breaking**. The database schema migrates forward on `serve`, so an upgrade needs only a restart.

## 0.2.0 - unreleased

The first published release.

### Contributors

- `fervo clone`, `context`, `claim`, `submit`, `status`, `renew`, `release`, `abandon` and `retry`: claim a scope and an intent, work in the lease's own worktree, push and submit, and wait for the verdict.
- `fervo clone` with a human token holds an enroller token, never the human's own. `fervo enroll` gives each harness session its own actor (a Claude Code `SessionStart` hook, or `--session` for any harness), and `fervo delegate` starts a Claude Code session with human powers.

### Server

- `fervo init` and `fervo serve`: a bare repository and its SQLite state behind authenticated Git smart HTTP and a JSON API, with idempotent writes and long polls that wake on commit.
- Policy in `fervo.toml` on `main`: tests, paired metric scoring against the frontier, model review, scope and human requirements per path, pinned paths, and auto-rebase of clean nodes. Changing the policy is itself a node that needs tests and a human's own verdict.
- Typed HTTP statuses, versioned schema migrations, `--public-url`, `/healthz`, a 1 MB body cap, and a graceful SIGTERM.
- `fervo events` reads the event log; `--follow` keeps reading.

### Runner

- `fervo runner` leases baseline, evaluation, review, claim-review and post-merge jobs, runs tests and metrics without the token and keys in their environment, and calls Anthropic or OpenAI models with the operator's keys.
- Each command runs in its own process group, killed at its timeout and when the runner stops.

### Library and extensions

- `import { createFervoServer, State, runRunner, ClaimIn, … } from 'fervo'` embeds the server and the runner; the API schemas are zod objects, and JSON Schemas in `docs/schemas/`.
- Server extensions, listed in `<root>/.fervo/settings.json`: merge rules, claim and submit gates, event listeners. Runner extensions, `--extension`: job producers, model providers, model middleware, command rewrites. Types from `fervo/extension`.

### Operating

- Recipe: TLS behind Caddy.
