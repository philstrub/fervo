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


def node_status(state: str, reason: str | None) -> dict:
    return {"node": "n_57", "state": state, "outcome": "improved", "delta": 0.09, "interval": [0.04, 0.14], "rank": None, "reason": reason, "job": None}


def test_merge_sends_the_reason_and_prints_the_merged_node(workdir: Path, respx_mock, fervo) -> None:
    merged = node_status("merged", None)
    route = respx_mock.post(f"{API}/nodes/n_57/merge").respond(json=merged)
    result = fervo("merge", "n_57", "--reason", "demo deadline; reviewed by hand", "--key", "m0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == merged
    assert json.loads(route.calls.last.request.content) == {"reason": "demo deadline; reviewed by hand"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "m0"


def test_veto_sends_the_reason_and_prints_the_abandoned_node(workdir: Path, respx_mock, fervo) -> None:
    vetoed = node_status("abandoned", "changes the public API")
    route = respx_mock.post(f"{API}/nodes/n_57/veto").respond(json=vetoed)
    result = fervo("veto", "n_57", "--reason", "changes the public API", "--key", "x0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == vetoed
    assert json.loads(route.calls.last.request.content) == {"reason": "changes the public API"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "x0"


def test_revert_sends_the_reason_and_prints_the_reverted_node(workdir: Path, respx_mock, fervo) -> None:
    reverted = node_status("reverted", "held-out tests regress")
    route = respx_mock.post(f"{API}/nodes/n_57/revert").respond(json=reverted)
    result = fervo("revert", "n_57", "--reason", "held-out tests regress", "--key", "r0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == reverted
    assert json.loads(route.calls.last.request.content) == {"reason": "held-out tests regress"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "r0"
