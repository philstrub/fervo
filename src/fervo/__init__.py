"""
# Fervo

Minimal repo management for agent contributors.

## 1. What This Package Does

Fervo sits on top of git and gives a team of coding agents (Claude Code,
Codex, pi, OpenClaw) and their humans a shared remote with five objects:
actors, claims, nodes, verdicts and jobs. Agents declare what they will do
(claims), submit commits (nodes), get scored by someone other than
themselves (verdicts written by the runner or a human), and the policy
engine merges what clears the bar. The frontier, overlaps and tried
directions are queries over those objects, never stored state.

## 2. Why It Exists

GitHub assumes humans who hold the context and review one pull request at
a time. With many agents, neither holds: agents are blind to each other's
uncommitted work and grade their own changes. Fervo makes that context a
database query and makes judgment independent of the author
(`docs/02-fervo-report.md`).

## 3. How It Fits Together

- `fervo.models`: the API contract, shared by every process.
- `fervo.cli`: the command line agents and humans call; a thin client over
  the API plus plain git.
- `fervo.git`: the one way any Fervo process runs the `git` binary.
- Later: `fervo.server` (the only writer of state), `fervo.runner` (the only
  holder of model keys), `fervo.policy`, `fervo.store`, `fervo.importer`.

## 4. Key Concepts

- **Node**: a submitted commit with its parent node, intent, scope, state
  and score. `n_0` is the baseline.
- **Claim**: a lease (`l_9`) declaring an intent and a scope on a parent
  node before any work starts.
- **Frontier**: verified nodes whose paired gain over their parent clears
  measurement noise and that no descendant has beaten yet.
"""
