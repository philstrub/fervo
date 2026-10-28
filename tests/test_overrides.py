"""
# Human commands: review, merge, veto, revert

## 1. What This Module Tests

That each human command sends its body to the right node endpoint with
its key and prints the server's answer, and that a refusal for a token
that is not a human's exits 1. The permission itself is the server's.
"""

import json
from pathlib import Path

from conftest import API


def test_review_pass_sends_a_passing_verdict(workdir: Path, respx_mock, fervo) -> None:
    verdict = {"id": "v_3", "node": "n_57", "reviewer": "filippo", "producer": "human", "provider": None, "passed": True, "evidence": "read the diff; scope respected"}
    route = respx_mock.post(f"{API}/nodes/n_57/verdicts").respond(json=verdict)
    result = fervo("review", "n_57", "--pass", "--evidence", "read the diff; scope respected", "--key", "v0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == verdict
    assert json.loads(route.calls.last.request.content) == {"passed": True, "evidence": "read the diff; scope respected"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "v0"


def test_review_fail_from_an_agent_token_is_refused(workdir: Path, respx_mock, fervo) -> None:
    route = respx_mock.post(f"{API}/nodes/n_57/verdicts").respond(403, json={"detail": "only humans and the runner write verdicts"})
    result = fervo("review", "n_57", "--fail", "--evidence", "breaks the API", "--key", "v1")
    assert result.exit_code == 1
    assert "only humans" in result.stderr
    assert json.loads(route.calls.last.request.content)["passed"] is False


def test_review_requires_a_verdict(workdir: Path, fervo) -> None:
    assert fervo("review", "n_57", "--evidence", "x", "--key", "v2").exit_code == 2
