"""
# fervo abandon

## 1. What This Module Tests

That `fervo abandon` sends the reason with its key and prints the node,
and that a reason is required.
"""

import json
from pathlib import Path

from conftest import API

ABANDONED = {"node": "n_57", "state": "abandoned", "outcome": None, "delta": None, "interval": None, "rank": None, "reason": "approach cannot beat the cache", "job": None}


def test_abandon_sends_the_reason_and_prints_the_node(workdir: Path, respx_mock, fervo) -> None:
    route = respx_mock.post(f"{API}/nodes/n_57/abandon").respond(json=ABANDONED)
    result = fervo("abandon", "n_57", "--reason", "approach cannot beat the cache", "--key", "a0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == ABANDONED
    assert json.loads(route.calls.last.request.content) == {"reason": "approach cannot beat the cache"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "a0"


def test_abandon_requires_a_non_empty_reason(workdir: Path, fervo) -> None:
    assert fervo("abandon", "n_57", "--key", "a0").exit_code == 2
    assert fervo("abandon", "n_57", "--reason", "", "--key", "a0").exit_code != 0
