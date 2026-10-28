"""
# Remote

How a CLI command finds the Fervo server, calls it and prints the answer.

## 1. What This Module Does

- `load_remote(cwd)` reads the API URL and the auth header from the
  clone's `.git/config`, where `fervo clone` wrote them.
- `get` and `post` call the JSON API. `post` always sends an
  `Idempotency-Key`. A non-2xx answer prints the server's body to stderr
  and exits 1.
- `emit` prints any model, list or dict as JSON on stdout.

## 2. Why This Module Exists

Every command needs the same three steps, and agents rely on them being
identical across commands: the same auth, the same error shape, the same
output format. This is the CLI's API boundary, so it is the one place that
turns an HTTP error into an exit code.

## 3. How It Fits in the Architecture

`main.py` commands call `load_remote`, then `get`/`post`, validate the
result with a `fervo.models` class and `emit` it.

## 4. Key Concepts

- The token is stored once, as `http.<git_url>.extraHeader` in
  `.git/config`. git sends it on fetch and push; the CLI sends the same
  header to the API. There is no credential helper.
- `fervo.url` is the API base URL; `fervo.prefix` (`agents/<actor>` or
  `humans/<actor>`) is the only branch namespace this actor may push to.
"""

import json
import sys
from pathlib import Path
from typing import Any

import httpx
import typer
from pydantic import BaseModel
from pydantic_core import to_jsonable_python

from fervo.git import git


class Remote(BaseModel):
    url: str  # API base URL, e.g. http://laptop:8000
    auth: str  # Authorization header value, "Bearer <token>"


def load_remote(cwd: Path) -> Remote:
    git_url = git(cwd, "remote", "get-url", "origin")
    header = git(cwd, "config", "--get", f"http.{git_url}.extraheader")
    return Remote(
        url=git(cwd, "config", "--get", "fervo.url"),
        auth=header.removeprefix("Authorization: "),
    )


def _checked(response: httpx.Response) -> Any:
    if response.is_error:
        typer.echo(response.text, err=True)
        raise typer.Exit(1)
    return response.json()


def get(remote: Remote, path: str, params: dict[str, Any] | None = None) -> Any:
    return _checked(
        httpx.get(remote.url + path, params=params, headers={"Authorization": remote.auth}, timeout=30)
    )


def post(remote: Remote, path: str, key: str, body: BaseModel | None = None) -> Any:
    return _checked(
        httpx.post(
            remote.url + path,
            json=body.model_dump(mode="json") if body else None,
            headers={"Authorization": remote.auth, "Idempotency-Key": key},
            timeout=30,
        )
    )


def emit(data: Any) -> None:
    typer.echo(json.dumps(to_jsonable_python(data), indent=2 if sys.stdout.isatty() else None))
