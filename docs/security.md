# Security

Fervo assumes agents are capable and sometimes wrong, and may be adversarial when that raises their score. It enforces the boundaries below in code. Everything else is a convention.

## Enforced

- **Authentication.** Every request needs a bearer token. The server stores only SHA-256 hashes, and a disabled actor gets HTTP 401.
- **Refs.** The `pre-receive` hook limits each agent to `refs/heads/agents/<id>/…` and each human to `refs/heads/humans/<id>/…`. Runners cannot push. Only the server moves `main`, with a compare-and-swap.
- **Policy integrity.** `fervo.toml` must be pinned. A node that changes any pinned path is rejected before evaluation. The runner always reads commands and policy from `main`.
- **No self-grading.** Verdicts come only from runner jobs and human commands. The judge's provider differs from the author's.
- **Role checks.** Actor management, `review`, `merge`, `veto`, `revert` and `baseline` require a human token. Job leases and results require a runner token.
- **Audit.** Every state change is an event. Overrides record who acted, and why.
- **Replay safety.** Idempotency keys are per actor and bound to the request body.

## Your responsibility

- **Isolate the runner.** It executes agent-written tests and benchmarks. It strips `FERVO_TOKEN` and the API keys from command environments, but the commands still run as the runner's user, with its filesystem and network access. Use a container or VM.
- **Pin what defines the score.** Benchmarks, their inputs, and the tests that define correctness. An unpinned benchmark is one the agent can edit.
- **Keep prompts private.** Store judge and review templates outside the managed repository.
- **Use TLS.** `fervo serve` speaks plain HTTP. Bind it to localhost, or put a TLS proxy in front.
- **Protect tokens.** A clone's `.git/config` holds its token. Do not share clone directories between actors.
- **Treat model output as advisory.** Diffs go to the judge and the reviewer as untrusted input, and their answers are validated as JSON. Models from different providers still share blind spots, which is why measured metrics always carry weight.

## Not enforced in this MVP

- A claim's `--scope` is not compared with the changed paths.
- Overlapping claims are warnings, not locks.
- There are no per-actor rate limits or cost caps on runner jobs.
