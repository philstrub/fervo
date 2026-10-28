"""
# fervo clone

## 1. What This Module Tests

That `fervo clone` checks the token with the server, clones from the git
URL the server names, and leaves a clone the other commands can use.
"""

import json
from pathlib import Path

from conftest import API, TOKEN, actor

from fervo.cli.remote import Remote, load_remote
from fervo.git import git


def test_clone_stores_remote_and_token_in_git_config(workdir: Path, bare: Path) -> None:
    assert (workdir / "README.md").read_text() == "toy repo\n"
    assert git(workdir, "config", "--get", "fervo.prefix") == "agents/claude-1"
    assert git(workdir, "config", "--get", f"http.{bare.as_uri()}.extraheader") == f"Authorization: Bearer {TOKEN}"
    assert load_remote(workdir) == Remote(url=API, auth=f"Bearer {TOKEN}")


def test_clone_prints_path_and_branch_prefix(tmp_path: Path, bare: Path, respx_mock, fervo, monkeypatch) -> None:
    route = respx_mock.get(f"{API}/whoami").respond(json={"actor": actor("filippo", "human"), "git_url": bare.as_uri()})
    monkeypatch.chdir(tmp_path)
    result = fervo("clone", API + "/", "mine", "--token", TOKEN)
    assert result.exit_code == 0, result.output
    assert route.calls.last.request.headers["Authorization"] == f"Bearer {TOKEN}"
    out = json.loads(result.stdout)
    assert out["path"] == str((tmp_path / "mine").resolve())
    assert out["branch_prefix"] == "humans/filippo"


def test_clone_refuses_a_runner_token(tmp_path: Path, bare: Path, respx_mock, fervo, monkeypatch) -> None:
    respx_mock.get(f"{API}/whoami").respond(json={"actor": actor("runner", "runner"), "git_url": bare.as_uri()})
    monkeypatch.chdir(tmp_path)
    result = fervo("clone", API, "runner-clone", "--token", TOKEN)
    assert result.exit_code != 0
    assert not (tmp_path / "runner-clone").exists()


def test_clone_exits_1_on_a_bad_token(tmp_path: Path, respx_mock, fervo, monkeypatch) -> None:
    respx_mock.get(f"{API}/whoami").respond(401, json={"detail": "unknown token"})
    monkeypatch.chdir(tmp_path)
    result = fervo("clone", API, "nope", "--token", "wrong")
    assert result.exit_code == 1
    assert "unknown token" in result.stderr
