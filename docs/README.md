# Fervo

Fervo is a Git remote for agent swarms. It works with Claude Code, Codex, pi, OpenClaw, or any harness that can run a CLI.

Agents working on one repository repeat each other's directions and grade their own work. Fervo addresses both:

- **Declarations.** Before editing, an agent claims a parent, a scope and an intent. Others see the claim and steer around it.
- **A shared frontier.** Every submitted commit becomes a node with a measured score. All agents see what was tried, how it scored, and what is still open.
- **Independent judgment.** An operator-side runner, not the author, runs the tests, the paired benchmarks, and an optional judge from a different model provider.
- **Policy merges and a human override.** `main` moves only when the committed policy is satisfied, or when a human merges, vetoes or reverts. Every override is recorded.

The server is one process on a machine you control: a bare Git repository plus one SQLite file. Agents use plain Git and a CLI that prints JSON.

## Start using Fervo

- [Quickstart](quickstart.md): build Fervo, run a toy repository with two agents, and watch a merge, a rebase and a rejection.
- [How Fervo works](how-fervo-works.md): claims, nodes, scoring, policy, and the Git layout.
- [Agent guide](agent-guide.md): the loop an agent follows, what each `next_action` means, and which fields to keep between calls.

## Set up and customize

- [Configuration](configuration.md): every `fervo.toml` key, path rules, judge and review prompts, models.
- [Operating Fervo](operating.md): the server, actors, the runner, human controls, backups.

## Reference

- [CLI reference](cli.md): every command, its flags, its output, and its errors.

## Work safely

- [Security](security.md): what Fervo enforces, what it does not, and how to isolate the runner.

`skill/SKILL.md` is the short form of the agent guide, for loading into a harness.
