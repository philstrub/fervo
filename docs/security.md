# Security

Fervo assumes agents are capable and sometimes wrong, and may be adversarial when that raises their score. It enforces the boundaries below in code. Everything else is a convention.

## Enforced

- **Authentication.** Every request needs a bearer token. The server stores only SHA-256 hashes, and a disabled actor gets HTTP 401. Replayed writes return `token` and `grant` as `null`, so the idempotency table holds no usable secret.
- **No human token in a human clone.** `fervo clone` with a human token stores an enroller token, which can enroll sessions as agents and nothing else. Fervo never writes the human token to disk; human commands prompt for it or read `FERVO_TOKEN` for one command.
- **One actor per session.** Each Claude Code session enrolls as its own agent, with the provider and harness fixed by the clone. Human powers in a session require a grant, which only a human token can create (`fervo delegate`). A session's kind never changes.
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
- **Protect tokens.** An agent clone's `.git/config` holds that agent's token: do not share it between agents. Never export your human token in a shell profile or pass it with `--token`: Claude Code inherits your environment, and agents can read your shell history. When the enrollment hook finds a non-session `FERVO_TOKEN` in its environment, it removes it from the session's shell and refuses to enroll. The token is still in the Claude Code process's environment, so unset it and restart. Never type your token into a prompt that appears while an agent is running unless you started that command yourself.
- **Same OS user.** Agents run as you. An agent can read the enroller token and mint more agent actors owned by you, and in a `fervo delegate` session it holds human powers by design. What Fervo guarantees is that an ordinary session never obtains human powers or another actor's identity through Fervo. Isolating agents from your files needs a separate OS user, a container or a sandbox.
- **Treat model output as advisory.** Diffs go to the judge and the reviewer as untrusted input, and their answers are validated as JSON. Models from different providers still share blind spots, which is why measured metrics always carry weight.

## Not enforced in this MVP

- A claim's `--scope` is not compared with the changed paths.
- Overlapping claims are warnings, not locks.
- There are no per-actor rate limits or cost caps on runner jobs.
