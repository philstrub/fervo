"""
# fervo claim

## 1. What This Module Tests

That `fervo claim` sends the declaration with its idempotency key, prints
warnings without failing, and with `--checkout` leaves the agent on its
lease branch at the parent's commit.
"""

import json
from pathlib import Path

from conftest import API

from fervo.git import git


def claim_out(parent_commit: str) -> dict:
    return {
        "lease": "l_9",
        "parent": "n_0",
        "parent_commit": parent_commit,
        "parent_ref": "refs/fervo/nodes/n_0",
        "expires_at": "2026-10-27T12:00:00Z",
        "blocked": ["bench/**"],
        "overlaps": [{"kind": "claim", "id": "l_7", "by": "codex-1", "scope": ["src/lexer/tokens.py"], "intent": "faster tokens"}],
    }


def test_claim_sends_the_declaration_and_prints_warnings(workdir: Path, respx_mock, fervo) -> None:
    head = git(workdir, "rev-parse", "HEAD")
    route = respx_mock.post(f"{API}/claims").respond(json=claim_out(head))
    result = fervo("claim", "--parent", "n_0", "--scope", "src/lexer/", "--scope", "bench/", "--intent", "incremental tokenizer", "--key", "k0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == claim_out(head)
    request = route.calls.last.request
    assert request.headers["Idempotency-Key"] == "k0"
    assert json.loads(request.content) == {"parent": "n_0", "scope": ["src/lexer/", "bench/"], "intent": "incremental tokenizer"}
    assert git(workdir, "branch", "--show-current") == "main"


def test_claim_checkout_branches_at_the_parent_node_ref(workdir: Path, bare: Path, respx_mock, fervo) -> None:
    parent_commit = git(bare, "rev-parse", "main")
    git(bare, "update-ref", "refs/fervo/nodes/n_0", parent_commit)
    (workdir / "local.txt").write_text("unpushed\n")
    git(workdir, "add", "local.txt")
    git(workdir, "commit", "--quiet", "-m", "local work that is not the parent")
    respx_mock.post(f"{API}/claims").respond(json=claim_out(parent_commit))
    result = fervo("claim", "--parent", "n_0", "--scope", "src/", "--intent", "x", "--key", "k1", "--checkout")
    assert result.exit_code == 0, result.output
    assert git(workdir, "branch", "--show-current") == "agents/claude-1/l_9"
    assert git(workdir, "rev-parse", "HEAD") == parent_commit


def test_claim_requires_a_key(workdir: Path, fervo) -> None:
    result = fervo("claim", "--parent", "n_0", "--scope", "src/", "--intent", "x")
    assert result.exit_code == 2
    assert "--key" in result.output
