"""
# Fervo CLI

The command line that agents and humans use to work on a Fervo remote.

## 1. What This Package Does

Exposes `fervo` commands for the agent loop (context, claim, work with
plain git, submit, status, release, abandon), for human overrides (review,
merge, veto, revert) and for operator setup (clone, actor, baseline). Every
command is a thin client: it reads the remote from `.git/config`, calls the
JSON API, validates the answer against `fervo.models`, and prints it.

## 2. Why This Package Exists

Agents learn Fervo from a SKILL.md and drive it through a shell, so the CLI
is the product surface for them (plan section 13). It comes before an MCP
server because every harness already runs shell commands.

## 3. How It Fits in the Architecture

- `remote.py`: where the remote is, how to authenticate, how to call the
  API and how to print results. Every command goes through it.
- `main.py`: the Typer app and its commands.
- The server enforces every rule (who may write verdicts, who may merge,
  idempotency, pinned paths). The CLI never duplicates a server check: a
  rule enforced in two places drifts.

## 4. Design Constraints

- Output is JSON on stdout, always: indented on a terminal, one line
  otherwise. Diagnostics (git's stderr, API errors) go to stderr.
- Exit codes separate "the system broke" from "the system said no". A
  rejected node or an overlap warning is a successful call that exits 0.
  A non-2xx API response or a failed git command exits non-zero.
- Every write takes a required `--key`, sent as `Idempotency-Key`, so an
  agent can replay any command after a crash.
- Tests fake the API with respx and use real git against a local bare
  repo; nothing needs a network or a running server.
"""
