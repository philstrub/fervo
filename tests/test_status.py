"""
# fervo status

## 1. What This Module Tests

That `fervo status` prints a node's status, that `--wait` polls with
backoff until the evaluation is over, and that `--timeout` ends the wait
with the last status and exit 0.
"""

import json
from pathlib import Path

import httpx
import pytest

from conftest import API


def node_status(state: str, **fields) -> dict:
    return {"node": "n_57", "state": state, "outcome": None, "delta": None, "interval": None, "rank": None, "reason": None, "job": "j_31"} | fields


VERIFIED = node_status("verified", outcome="improved", delta=0.09, interval=[0.04, 0.14], rank=1, job=None)


@pytest.fixture
def sleeps(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    slept: list[float] = []
    monkeypatch.setattr("fervo.cli.main.time.sleep", slept.append)
    return slept


def test_status_prints_a_rejected_node_and_exits_0(workdir: Path, respx_mock, fervo) -> None:
    rejected = node_status("rejected", reason="touched pinned path bench/", job=None)
    respx_mock.get(f"{API}/status/n_57").respond(json=rejected)
    result = fervo("status", "n_57")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == rejected


def test_status_wait_polls_with_backoff_until_evaluated(workdir: Path, respx_mock, fervo, sleeps) -> None:
    answers = [node_status("submitted"), node_status("evaluating"), node_status("evaluating"), VERIFIED]
    route = respx_mock.get(f"{API}/status/j_31").mock(side_effect=[httpx.Response(200, json=a) for a in answers])
    result = fervo("status", "j_31", "--wait")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == VERIFIED
    assert route.call_count == 4
    assert sleeps == [1, 2, 4]


def test_status_wait_gives_up_at_the_timeout(workdir: Path, respx_mock, fervo, sleeps) -> None:
    respx_mock.get(f"{API}/status/n_57").respond(json=node_status("evaluating"))
    result = fervo("status", "n_57", "--wait", "--timeout", "0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout)["state"] == "evaluating"
    assert sleeps == []
