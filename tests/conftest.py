"""
# CLI Test Fixtures

A real git remote and a fake Fervo API, with no network and no server.

## 1. What This Module Does

- Isolates git from the developer's own config and identity.
- `bare`: a bare repo with one commit on `main`, served over `file://`.
- `workdir`: a clone of it made by `fervo clone`, with the API faked by
  respx at `API`; the test runs inside it.
- `fervo`: runs a CLI command in-process and returns its result.

## 2. Why This Module Exists

The CLI's job is to turn arguments into the right API calls and the right
git operations. respx checks the first exactly (every route a test
registers must be called), and a real bare repo checks the second, so the
tests exercise what an agent would actually run.

## 3. How It Fits in the Architecture

`GET /whoami` returns the bare repo's `file://` URL as `git_url`, which is
the same seam a one-laptop demo uses (DECISIONS.md), so no git server is
needed.

## 4. Key Concepts

- `API` is a fake host; any call to a route the test did not register
  fails the test.
"""

from collections.abc import Callable
from pathlib import Path

import pytest
from typer.testing import CliRunner, Result

from fervo.cli.main import app
from fervo.git import git

API = "http://fervo.test"
TOKEN = "secret-token"


def actor(id: str = "claude-1", kind: str = "agent") -> dict:
    return {"id": id, "kind": kind, "provider": "anthropic", "model": "claude-sonnet-5-5", "harness": "claude-code", "disabled": False}


@pytest.fixture(autouse=True)
def isolated_git(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", "/dev/null")
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    for role in ("AUTHOR", "COMMITTER"):
        monkeypatch.setenv(f"GIT_{role}_NAME", "Test")
        monkeypatch.setenv(f"GIT_{role}_EMAIL", "test@example.com")


@pytest.fixture
def bare(tmp_path: Path) -> Path:
    seed = tmp_path / "seed"
    git(tmp_path, "init", "--quiet", "-b", "main", str(seed))
    (seed / "README.md").write_text("toy repo\n")
    git(seed, "add", "README.md")
    git(seed, "commit", "--quiet", "-m", "initial")
    git(tmp_path, "clone", "--quiet", "--bare", str(seed), "repo.git")
    return tmp_path / "repo.git"


@pytest.fixture
def fervo() -> Callable[..., Result]:
    runner = CliRunner()
    return lambda *args: runner.invoke(app, list(args))


@pytest.fixture
def workdir(tmp_path: Path, bare: Path, respx_mock, fervo, monkeypatch: pytest.MonkeyPatch) -> Path:
    respx_mock.get(f"{API}/whoami").respond(json={"actor": actor(), "git_url": bare.as_uri()})
    monkeypatch.chdir(tmp_path)
    result = fervo("clone", API, "work", "--token", TOKEN)
    assert result.exit_code == 0, result.output
    monkeypatch.chdir(tmp_path / "work")
    return tmp_path / "work"
