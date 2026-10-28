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

from pathlib import Path
from typing import Annotated

import typer

from fervo.cli.remote import Remote, emit, get
from fervo.git import git
from fervo.models import Whoami

app = typer.Typer(no_args_is_help=True, add_completion=False)


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
