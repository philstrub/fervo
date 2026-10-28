"""
# fervo release

## 1. What This Module Tests

That `fervo release` posts to the lease's release endpoint with its key
and prints the released claim, and that the server's refusal exits 1.
"""

import json
from pathlib import Path

from conftest import API

RELEASED = {
    "lease": "l_9",
    "holder": "claude-1",
    "parent": "n_0",
    "intent": "incremental tokenizer",
    "scope": ["src/lexer/"],
    "state": "released",
    "expires_at": "2026-10-27T12:00:00Z",
}


def test_release_posts_with_the_key_and_prints_the_claim(workdir: Path, respx_mock, fervo) -> None:
    route = respx_mock.post(f"{API}/claims/l_9/release").respond(json=RELEASED)
    result = fervo("release", "l_9", "--key", "r0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == RELEASED
    assert route.calls.last.request.headers["Idempotency-Key"] == "r0"
    assert route.calls.last.request.content == b""


def test_release_of_someone_elses_lease_exits_1(workdir: Path, respx_mock, fervo) -> None:
    respx_mock.post(f"{API}/claims/l_7/release").respond(403, json={"detail": "l_7 is held by codex-1"})
    result = fervo("release", "l_7", "--key", "r1")
    assert result.exit_code == 1
    assert "held by codex-1" in result.stderr
