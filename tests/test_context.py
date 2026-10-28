"""
# fervo context

## 1. What This Module Tests

That `fervo context` sends the clone's token and its filters, prints the
server's context unchanged, and refuses a response that breaks the
contract.
"""

import json
from pathlib import Path

from conftest import API, TOKEN

CONTEXT = {
    "goal": "Streaming parser API; keep the public interface stable",
    "metrics": [{"name": "throughput", "direction": "max", "weight": 0.6}],
    "main": {"commit": "a1b2c3d", "node": "n_40"},
    "frontier": [
        {"node": "n_42", "rank": 1, "delta": 0.04, "interval": [0.01, 0.07], "intent": "cache tokens", "author": "claude-2", "ref": "refs/fervo/nodes/n_42"}
    ],
    "claims": [{"lease": "l_7", "by": "codex-1", "scope": ["src/lexer/tokens.py"], "intent": "faster tokens", "since": "2026-10-27T10:00:00Z"}],
    "tried": [
        {"node": "n_49", "intent": "edit the benchmark", "scope": ["bench/"], "state": "rejected", "outcome": None, "reason": "touched pinned path bench/", "at": "2026-10-27T09:00:00Z"}
    ],
    "rules": {"pinned": ["bench/**", "fervo.toml"], "requirements_by_path": {"*": ["tests", "frontier_gain"]}},
    "mine": {"leases": [], "updates": [{"subject": "n_44", "event": "needs_rebase", "at": "2026-10-27T10:05:00Z"}]},
    "frontier_version": 1832,
    "summary": None,
}


def test_context_prints_the_servers_context(workdir: Path, respx_mock, fervo) -> None:
    route = respx_mock.get(f"{API}/context").respond(json=CONTEXT)
    result = fervo("context")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == CONTEXT
    request = route.calls.last.request
    assert request.headers["Authorization"] == f"Bearer {TOKEN}"
    assert request.url.params.get_list("scope") == []
    assert request.url.params["summary"] == "false"


def test_context_sends_every_scope_and_the_summary_flag(workdir: Path, respx_mock, fervo) -> None:
    pending = {**CONTEXT, "summary": {"status": "pending", "text": None, "job": "j_5"}}
    route = respx_mock.get(f"{API}/context").respond(json=pending)
    result = fervo("context", "--scope", "src/lexer/", "--scope", "docs/", "--summary")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout)["summary"]["job"] == "j_5"
    params = route.calls.last.request.url.params
    assert params.get_list("scope") == ["src/lexer/", "docs/"]
    assert params["summary"] == "true"


def test_context_rejects_a_response_that_breaks_the_contract(workdir: Path, respx_mock, fervo) -> None:
    respx_mock.get(f"{API}/context").respond(json={k: v for k, v in CONTEXT.items() if k != "goal"})
    result = fervo("context")
    assert result.exit_code != 0
    assert result.stdout == ""
