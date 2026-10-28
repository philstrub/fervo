"""
# fervo baseline

## 1. What This Module Tests

That `fervo baseline` enqueues a baseline job with its key and prints it.
"""

import json
from pathlib import Path

from conftest import API


def test_baseline_enqueues_a_job(workdir: Path, respx_mock, fervo) -> None:
    job = {"id": "j_1", "kind": "baseline", "node": None, "state": "queued"}
    route = respx_mock.post(f"{API}/baseline").respond(json=job)
    result = fervo("baseline", "--key", "b0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == job
    assert route.calls.last.request.headers["Idempotency-Key"] == "b0"
