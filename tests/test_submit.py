"""
# fervo submit

## 1. What This Module Tests

That `fervo submit` pushes the exact commit it submits to the actor's
lease branch on the real remote, and that it refuses a dirty tree before
touching the remote or the API.
"""

import json
from pathlib import Path

from conftest import API

from fervo.git import git


def test_submit_pushes_head_and_submits_that_commit(workdir: Path, bare: Path, respx_mock, fervo) -> None:
    (workdir / "lexer.py").write_text("def tokens(): ...\n")
    git(workdir, "add", "lexer.py")
    git(workdir, "commit", "--quiet", "-m", "incremental tokenizer")
    head = git(workdir, "rev-parse", "HEAD")
    route = respx_mock.post(f"{API}/submit").respond(json={"node": "n_57", "job": "j_31"})
    result = fervo("submit", "--lease", "l_9", "--key", "k1")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == {"node": "n_57", "job": "j_31"}
    assert git(bare, "rev-parse", "refs/heads/agents/claude-1/l_9") == head
    request = route.calls.last.request
    assert json.loads(request.content) == {"lease": "l_9", "commit": head}
    assert request.headers["Idempotency-Key"] == "k1"


def test_submit_refuses_uncommitted_changes(workdir: Path, bare: Path, fervo) -> None:
    (workdir / "README.md").write_text("edited but not committed\n")
    (workdir / "build.log").write_text("untracked files do not block\n")
    result = fervo("submit", "--lease", "l_9", "--key", "k1")
    assert result.exit_code == 1
    assert "uncommitted changes" in result.stderr
    assert git(bare, "for-each-ref", "refs/heads/agents/") == ""
