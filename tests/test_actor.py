"""
# fervo actor

## 1. What This Module Tests

That the actor commands send the right requests and print what the
server returns, including the one-time token.
"""

import json
from pathlib import Path

from conftest import actor, API


def test_actor_add_sends_the_actor_and_prints_the_token_once(workdir: Path, respx_mock, fervo) -> None:
    created = {"actor": actor("codex-1"), "token": "tok-codex-1"}
    route = respx_mock.post(f"{API}/actors").respond(json=created)
    result = fervo("actor", "add", "codex-1", "--kind", "agent", "--provider", "openai", "--model", "gpt-5.5", "--harness", "codex", "--key", "a0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == created
    assert json.loads(route.calls.last.request.content) == {"id": "codex-1", "kind": "agent", "provider": "openai", "model": "gpt-5.5", "harness": "codex"}
    assert route.calls.last.request.headers["Idempotency-Key"] == "a0"


def test_actor_add_refuses_an_id_that_cannot_be_a_branch_name(workdir: Path, fervo) -> None:
    assert fervo("actor", "add", "Claude 1", "--kind", "agent", "--key", "a1").exit_code != 0
    assert fervo("actor", "add", "claude-1", "--kind", "robot", "--key", "a2").exit_code == 2


def test_actor_list_prints_every_actor(workdir: Path, respx_mock, fervo) -> None:
    actors = [actor("claude-1"), actor("filippo", "human"), actor("runner", "runner")]
    respx_mock.get(f"{API}/actors").respond(json=actors)
    result = fervo("actor", "list")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == actors


def test_actor_disable_posts_with_the_key_and_prints_the_actor(workdir: Path, respx_mock, fervo) -> None:
    disabled = actor("codex-1") | {"disabled": True}
    route = respx_mock.post(f"{API}/actors/codex-1/disable").respond(json=disabled)
    result = fervo("actor", "disable", "codex-1", "--key", "d0")
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == disabled
    assert route.calls.last.request.headers["Idempotency-Key"] == "d0"
