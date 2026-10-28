"""
# The agent loop, end to end

## 1. What This Module Tests

The report's example as one agent would run it: read the context, claim
on the best frontier node with `--checkout`, commit, submit, and wait for
the verdict. The API is faked; git is real, so the test proves that the
commit the server is told about is the one on the lease branch, built on
the claimed parent.
"""

import json
from pathlib import Path

import httpx
import pytest

from conftest import API

from fervo.git import git


def test_context_claim_work_submit_status(workdir: Path, bare: Path, respx_mock, fervo, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("fervo.cli.main.time.sleep", lambda seconds: None)
    parent_commit = git(bare, "rev-parse", "main")
    git(bare, "update-ref", "refs/fervo/nodes/n_42", parent_commit)
    frontier = [{"node": "n_42", "rank": 1, "delta": 0.04, "interval": [0.01, 0.07], "intent": "cache tokens", "author": "claude-2", "ref": "refs/fervo/nodes/n_42"}]
    respx_mock.get(f"{API}/context").respond(json={
        "goal": "Streaming parser API", "metrics": [], "main": {"commit": parent_commit, "node": "n_40"},
        "frontier": frontier, "claims": [], "tried": [],
        "rules": {"pinned": ["bench/**"], "requirements_by_path": {}}, "mine": {"leases": [], "updates": []},
        "frontier_version": 7, "summary": None,
    })
    respx_mock.post(f"{API}/claims").respond(json={
        "lease": "l_9", "parent": "n_42", "parent_commit": parent_commit, "parent_ref": "refs/fervo/nodes/n_42",
        "expires_at": "2026-10-27T12:00:00Z", "blocked": [], "overlaps": [],
    })
    submit = respx_mock.post(f"{API}/submit").respond(json={"node": "n_57", "job": "j_31"})
    evaluating = {"node": "n_57", "state": "evaluating", "outcome": None, "delta": None, "interval": None, "rank": None, "reason": None, "job": "j_31"}
    verified = evaluating | {"state": "verified", "outcome": "improved", "delta": 0.09, "interval": [0.04, 0.14], "rank": 1, "job": None}
    respx_mock.get(f"{API}/status/j_31").mock(side_effect=[httpx.Response(200, json=evaluating), httpx.Response(200, json=verified)])

    best = json.loads(fervo("context").stdout)["frontier"][0]["node"]
    claimed = fervo("claim", "--parent", best, "--scope", "src/lexer/", "--intent", "incremental tokenizer", "--key", "k0", "--checkout")
    assert claimed.exit_code == 0, claimed.output
    (workdir / "src" / "lexer").mkdir(parents=True)
    (workdir / "src" / "lexer" / "stream.py").write_text("def feed(chunk): ...\n")
    git(workdir, "add", "src")
    git(workdir, "commit", "--quiet", "-m", "incremental tokenizer")
    submitted = fervo("submit", "--lease", "l_9", "--key", "k1")
    assert submitted.exit_code == 0, submitted.output
    result = fervo("status", json.loads(submitted.stdout)["job"], "--wait")

    assert json.loads(result.stdout) == verified
    pushed = git(bare, "rev-parse", "refs/heads/agents/claude-1/l_9")
    assert json.loads(submit.calls.last.request.content)["commit"] == pushed
    assert git(bare, "rev-parse", f"{pushed}^") == parent_commit
