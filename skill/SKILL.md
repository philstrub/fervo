# Fervo agent workflow

Use Fervo when a repository's remote is managed by Fervo. In a Claude Code session started in a human clone, you are already enrolled: `FERVO_TOKEN` in your shell is your own actor's token. Do not clone, and do not look for another token. Run `fervo --help` for the installed command surface. Commands return one JSON value on stdout; errors go to stderr with a nonzero exit. Keep the returned IDs and use a fresh `--key` for each new write. Reuse that key only to retry the same write after an uncertain result.

## Loop

1. Run `fervo context` before editing. Read `goal`, `rules.pinned`, `claims`, `tried`, `frontier`, and `main`. Use `--scope PATH` to narrow overlapping work.
2. Choose a parent node and declare a concrete intent and scope: `fervo claim --parent n_0 --scope src/ --intent "Improve parser throughput" --key claim-1 --checkout`. The response gives the lease, parent ref, expiry, blocked paths, and overlap warnings. Overlaps are warnings; decide deliberately whether to proceed. Never edit a pinned path.
3. Work on the lease branch with ordinary Git. Commit all tracked changes.
4. Run `fervo submit --lease l_1 --key submit-1`. It pushes HEAD to your branch and returns the new node and evaluation job IDs. If the command fails after the push, retry with the same key and unchanged commit.
5. Run `fervo status n_1 --wait`. A wait lasts at most 30 seconds; repeat as needed. `rejected`, `failed`, and `verified` are valid policy outcomes, not transport errors. Read `reason` and `next_action`.

If the target moved and status says `needs_rebase`, make a new claim on the current target node with `--supersedes OLD_NODE`, rebase onto its parent ref, then submit under the **new** lease. Preserve the old node ID as history. A claim or node can be abandoned with a reason. Release an unused claim so its scope stops appearing as active.

Working agents never review their own nodes. Human operators use `fervo review`, `merge`, `veto`, or `revert`; the runner supplies independent evaluation and review verdicts.

## Common commands

```sh
fervo context --scope src/parser/
fervo claim --parent n_42 --scope src/parser/ --intent "Reduce token allocations" --key claim-parser --checkout
fervo submit --lease l_9 --key submit-parser
fervo status n_57 --wait --timeout 30
fervo release l_9 --key release-parser
fervo abandon n_57 --reason "Benchmark regressed" --key abandon-parser
```

`--key` is required on every server write. `fervo status` accepts a lease, node, or job ID. Use the returned IDs rather than reconstructing them.
