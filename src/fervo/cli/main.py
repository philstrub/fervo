"""
# Fervo Commands

The Typer app behind the `fervo` executable.

## 1. What This Module Does

Defines every `fervo` command. Each one parses its arguments, builds a
request model, calls the API through `remote.py`, validates the response
with a `fervo.models` class, and prints it as JSON. The few commands that
touch git (clone, claim --checkout, submit) run it through `fervo.git`.

## 2. Why This Module Exists

The commands are the whole interface an agent learns from SKILL.md. They
stay in one module so the surface can be read top to bottom, in the order
of the loop: clone, context, claim, (work with plain git), submit, status,
release, abandon; then the human overrides; then operator setup.

## 3. How It Fits in the Architecture

Commands run inside a clone made by `fervo clone`, which is where they find
the remote. The server enforces every permission; a command that a token
may not use gets a 403 and exits 1.

## 4. Key Concepts

- Writes require `--key`. Replaying a command with the same key and the
  same arguments returns the first answer; the same key with different
  arguments is an error from the server.
- Branches: an actor pushes only under `refs/heads/<prefix>/`, where the
  prefix is `agents/<actor>` or `humans/<actor>`. A claim's work lives on
  `<prefix>/<lease>`.
"""

import time
from pathlib import Path
from typing import Annotated

import typer

from fervo.cli.remote import Remote, emit, get, load_remote, post
from fervo.git import git
from fervo.models import Claim, ClaimIn, ClaimOut, Context, NodeStatus, SubmitIn, SubmitOut, Whoami

app = typer.Typer(no_args_is_help=True, add_completion=False)

Key = Annotated[str, typer.Option(help="Idempotency key. Replaying a command with the same key returns the first answer.")]


@app.callback()
def fervo() -> None:
    """Minimal repo management for agent contributors."""


@app.command()
def clone(
    url: Annotated[str, typer.Argument(help="The Fervo server's API URL, e.g. http://laptop:8000.")],
    directory: Annotated[Path, typer.Argument(help="Where to create the clone.")],
    token: Annotated[str, typer.Option(envvar="FERVO_TOKEN", help="This actor's token.")],
) -> None:
    """Clone the repo and store the remote and token in .git/config."""
    remote = Remote(url=url.rstrip("/"), auth=f"Bearer {token}")
    whoami = Whoami.model_validate(get(remote, "/whoami"))
    prefix = {"agent": "agents", "human": "humans"}[whoami.actor.kind]
    git(
        Path.cwd(),
        "clone",
        "--quiet",
        "-c", f"http.{whoami.git_url}.extraHeader=Authorization: {remote.auth}",
        "-c", f"fervo.url={remote.url}",
        "-c", f"fervo.prefix={prefix}/{whoami.actor.id}",
        whoami.git_url,
        str(directory),
    )
    emit({"path": str(directory.resolve()), "actor": whoami.actor, "branch_prefix": f"{prefix}/{whoami.actor.id}"})


@app.command()
def context(
    scope: Annotated[list[str], typer.Option(help="Narrow claims and tried directions to those overlapping this path. Repeatable.")] = [],
    summary: Annotated[bool, typer.Option(help="Also ask for the runner's prose briefing; pending on the first call.")] = False,
) -> None:
    """Goal, frontier, open claims, tried directions, rules and your updates."""
    remote = load_remote(Path.cwd())
    emit(Context.model_validate(get(remote, "/context", {"scope": scope, "summary": summary})))


@app.command()
def claim(
    parent: Annotated[str, typer.Option(help="The node to build on, e.g. n_42.")],
    scope: Annotated[list[str], typer.Option(help="A path or glob you will change. Repeatable.")],
    intent: Annotated[str, typer.Option(help="What you will do and why, in a sentence.")],
    key: Key,
    checkout: Annotated[bool, typer.Option(help="Fetch the parent and switch to a new branch <prefix>/<lease> at it.")] = False,
) -> None:
    """Declare what you will do before you start. Returns the lease, blocked paths and overlaps."""
    cwd = Path.cwd()
    out = ClaimOut.model_validate(post(load_remote(cwd), "/claims", key, ClaimIn(parent=parent, scope=scope, intent=intent)))
    if checkout:
        git(cwd, "fetch", "--quiet", "origin", out.parent_ref)
        git(cwd, "checkout", "--quiet", "-b", f"{git(cwd, 'config', '--get', 'fervo.prefix')}/{out.lease}", "FETCH_HEAD")
    emit(out)


@app.command()
def release(lease: Annotated[str, typer.Argument(help="The lease to give up, e.g. l_9.")], key: Key) -> None:
    """Give up a claim you will not submit, so its scope stops showing as taken."""
    emit(Claim.model_validate(post(load_remote(Path.cwd()), f"/claims/{lease}/release", key)))


@app.command()
def submit(lease: Annotated[str, typer.Option(help="The lease this work was claimed under.")], key: Key) -> None:
    """Push HEAD to your lease branch and submit it as a node for independent evaluation."""
    cwd = Path.cwd()
    if git(cwd, "status", "--porcelain", "--untracked-files=no"):
        typer.echo("uncommitted changes to tracked files: commit them or stash them, then submit", err=True)
        raise typer.Exit(1)
    commit = git(cwd, "rev-parse", "HEAD")
    git(cwd, "push", "--quiet", "origin", f"HEAD:refs/heads/{git(cwd, 'config', '--get', 'fervo.prefix')}/{lease}")
    emit(SubmitOut.model_validate(post(load_remote(cwd), "/submit", key, SubmitIn(lease=lease, commit=commit))))


@app.command()
def status(
    id: Annotated[str, typer.Argument(help="A node (n_57) or the job evaluating it (j_31).")],
    wait: Annotated[bool, typer.Option(help="Poll with backoff until the node is no longer submitted or evaluating.")] = False,
    timeout: Annotated[int, typer.Option(help="With --wait, stop polling after this many seconds and print the last status.")] = 1800,
) -> None:
    """A node's state, outcome, paired gain over its parent, and frontier rank."""
    remote = load_remote(Path.cwd())
    out = NodeStatus.model_validate(get(remote, f"/status/{id}"))
    deadline = time.monotonic() + timeout
    delay = 1
    while wait and out.state in ("submitted", "evaluating") and time.monotonic() < deadline:
        time.sleep(delay)
        delay = min(delay * 2, 30)
        out = NodeStatus.model_validate(get(remote, f"/status/{id}"))
    emit(out)
