# Operating Fervo

## Prepare the source repository

Commit a valid `fervo.toml` on `main` (see [Configuration](configuration.md)). Run every metric once by hand: the last line it prints must be one positive number.

## Initialize

```sh
fervo init --source ./project --root ./managed --actor operator
```

`--root` must not exist yet. `init` creates:

- `managed/repo.git`: a bare clone with a `pre-receive` hook;
- `managed/.fervo/fervo.db`: the SQLite state;
- baseline node `n_0` at the current `main`, and a queued `baseline` job.

It prints `{root, actor, token, main}`. **The token is shown only once.** Only its hash is stored.

## Serve

```sh
fervo serve --root ./managed --host 127.0.0.1 --port 8765
```

It logs `[serve] listening on <host>:<port>` to stderr. The listener is plain HTTP: keep it on localhost, or put it behind a TLS reverse proxy. Git clone URLs are built from the request's `Host` header, so clients must reach the server under a stable name.

## Actors

Clone with the human token. `clone` prompts for it and never stores it; the clone holds an enroller token instead, and every `claude` session started in it enrolls as its own agent actor, `<you>-<session>`. Human commands prompt for the token each time, or take `FERVO_TOKEN=<token>` for one command. Run `fervo delegate` to start a Claude Code session with human powers.

```sh
fervo clone http://127.0.0.1:8765 ./op
cd op
claude                                    # an agent session: no actor add needed
fervo actor add runner --kind runner --key add-runner
fervo actor add claude-1 --kind agent --provider anthropic --model <model-id> --harness claude-code --key add-claude-1
fervo actor add alice --kind human --key add-alice
fervo actor list
fervo actor disable claude-1 --key disable-claude-1
```

- IDs use lowercase letters, digits and `-`, and must start with a letter or digit.
- Set `--provider` on agents. It decides which provider judges their nodes.
- Each `actor add` prints the new token once. A disabled token is refused with HTTP 401.
- Only humans can add, list or disable actors.

For agents outside Claude Code, give each one its own token through `FERVO_TOKEN` or `--token`, and have it run `fervo clone`. The token ends up in the clone's `.git/config`, never in the working tree. Enrolled sessions appear in `actor list` with their `owner` and `session`; `actor disable` revokes one.

## Run the runner

```sh
FERVO_TOKEN=<runner-token> ANTHROPIC_API_KEY=<key> OPENAI_API_KEY=<key> \
  fervo runner --remote http://127.0.0.1:8765 \
  --judge-template /operator/judge.txt --review-template /operator/review.txt \
  --anthropic-model <id> --openai-model <id> \
  --review-provider anthropic --review-model <id> --concurrency 2
```

- The first job is the baseline. An evaluation that runs before any baseline exists fails with `baseline missing`, and `fervo retry` re-queues it.
- Each worker keeps a mirror clone and runs every job in temporary worktrees.
- Commands run under `sh -c`, without `FERVO_TOKEN` or the API keys in their environment, and are killed at their timeout.
- Jobs queue while the runner is offline and resume when it returns.
- Keep the templates outside the managed repository, so agents cannot read how they are judged.

The runner executes agent-written code. Run it in a container or VM that holds only what it needs. See [Security](security.md).

## Human controls

Run these from a human clone, in your own terminal or a `fervo delegate` session. Each one is recorded as a verdict and an event, with its reason.

```sh
fervo review <node> --pass|--fail --evidence "<text>" --key <k>   # evidence for policy; --pass can trigger a merge
fervo merge  <node> --reason "<text>" --key <k>    # override: merge a verified node (needs human_override)
fervo veto   <node> --reason "<text>" --key <k>    # mark abandoned (open nodes only; merged nodes take revert)
fervo revert <node> --reason "<text>" --key <k>    # move main back to the node's parent
fervo retry  <node> --key <k>                      # re-evaluate a failed node
fervo abandon <node> --reason "<text>" --key <k>   # humans may abandon any node
fervo baseline --key <k>                           # re-measure main, e.g. after a hardware change
```

- `merge` needs a `verified` node whose parent is still `main`. Otherwise it reports `needs_rebase`.
- `revert` works only on the node that is currently the head of `main`. On an older node it fails with a Git compare-and-swap error.

## Watch the system

- `fervo context` from any clone shows the frontier, active claims and recent outcomes.
- `fervo status <node|lease|job>` shows a single object.
- The server and runner write their logs to stderr.

## Back up and reset

All state lives under `--root`. Stop the server, copy the directory, and restart. To change `fervo.toml`, initialize a new root from an updated source repository. A running instance cannot change its own policy.
