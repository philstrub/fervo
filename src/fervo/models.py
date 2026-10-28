"""
# API Contract

Every request and response that crosses a process boundary in Fervo.

## 1. What This Module Does

Defines the Pydantic models for the JSON API between `fervo serve` and its
clients: the CLI that agents and humans call, and later the runner. A
model suffixed `In` is a request body; every other model is a response.

## 2. Why This Module Exists

The contract lives in one place so that the CLI, the server, the runner and
the SKILL.md cannot drift apart (plan section 3). The CLI validates every
response against these models, so a server that breaks the contract fails
loudly at the client instead of handing an agent malformed JSON.

## 3. How It Fits in the Architecture

The server will import the `In` models to validate requests and return the
others. The CLI sends `In` models and validates responses. Changing a model
here is changing the API, and needs review from both authors (plan
section 14).

## 4. Key Concepts

- Ids are short typed strings: `n_57` (node), `l_9` (lease, the id of a
  claim), `j_31` (job). Actor ids are chosen by the operator (`claude-1`).
- A claim and a node are separate objects with separate state machines
  (plan section 4). The claim says what an agent will do; the node is the
  commit it submitted.
- `delta` and `interval` on a node are the paired gain over its parent and
  its 95% interval, as in the report. A node is `improved` when the whole
  interval is above zero.
- Writes carry an idempotency key in the `Idempotency-Key` header, never in
  the body.

## 5. Endpoints

Every request carries `Authorization: Bearer <token>`. Every POST carries
`Idempotency-Key`. Who may call each one is enforced by the server only.

| Method and path                 | Body       | Response          | Who                 |
|---------------------------------|------------|-------------------|---------------------|
| GET  /whoami                    |            | Whoami            | anyone              |
| GET  /context?scope=&summary=   |            | Context           | anyone              |
| POST /claims                    | ClaimIn    | ClaimOut          | agents, humans      |
| POST /claims/{lease}/release    |            | Claim             | the holder          |
| POST /submit                    | SubmitIn   | SubmitOut         | the lease's holder  |
| GET  /status/{node or job}      |            | NodeStatus        | anyone              |
| POST /nodes/{node}/abandon      | ReasonIn   | NodeStatus        | the author          |
| POST /nodes/{node}/verdicts     | ReviewIn   | Verdict           | humans, not author  |
| POST /nodes/{node}/merge        | ReasonIn   | NodeStatus        | humans              |
| POST /nodes/{node}/veto         | ReasonIn   | NodeStatus        | humans              |
| POST /nodes/{node}/revert       | ReasonIn   | NodeStatus        | humans              |
| POST /actors                    | ActorIn    | ActorCreated      | humans              |
| GET  /actors                    |            | list[Actor]       | humans              |
| POST /actors/{id}/disable       |            | Actor             | humans              |
| POST /baseline                  |            | Job               | humans              |

The runner's job endpoints (plan section 9) are not defined yet.
"""

from typing import Literal

from pydantic import BaseModel, Field

ActorKind = Literal["human", "agent", "runner", "system"]
ClaimState = Literal["active", "submitted", "expired", "released"]
NodeState = Literal[
    "submitted", "evaluating", "verified", "merged", "reverted", "rejected", "failed", "abandoned"
]
Outcome = Literal["improved", "within_noise", "worse"]
JobKind = Literal["eval", "review", "summary", "postmerge", "baseline"]
JobState = Literal["queued", "running", "done", "failed"]


class Actor(BaseModel):
    id: str
    kind: ActorKind
    provider: str | None
    model: str | None
    harness: str | None
    disabled: bool


class ActorIn(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    kind: ActorKind
    provider: str | None
    model: str | None
    harness: str | None


class ActorCreated(BaseModel):
    actor: Actor
    token: str  # shown once; the server keeps only its hash


class Whoami(BaseModel):
    actor: Actor
    git_url: str  # where this server serves the repo: http(s)://, ssh:// or file://


class ClaimIn(BaseModel):
    parent: str
    scope: list[str] = Field(min_length=1)  # path globs or directory prefixes
    intent: str = Field(min_length=1)


class Overlap(BaseModel):
    kind: Literal["claim", "node"]  # an active claim, or a past node
    id: str  # lease or node id
    by: str
    scope: list[str]
    intent: str


class ClaimOut(BaseModel):
    lease: str
    parent: str
    parent_commit: str
    parent_ref: str  # refs/fervo/nodes/<parent>, fetchable from the remote
    expires_at: str
    blocked: list[str]  # pinned paths inside the scope: any change to them is rejected
    overlaps: list[Overlap]  # warnings, never refusals


class Claim(BaseModel):
    lease: str
    holder: str
    parent: str
    intent: str
    scope: list[str]
    state: ClaimState
    expires_at: str


class SubmitIn(BaseModel):
    lease: str
    commit: str


class SubmitOut(BaseModel):
    node: str
    job: str


class NodeStatus(BaseModel):
    node: str
    state: NodeState
    outcome: Outcome | None
    delta: float | None
    interval: tuple[float, float] | None
    rank: int | None  # position on the frontier, None when not on it
    reason: str | None  # why it was rejected, failed, held or reverted
    job: str | None  # the job currently working on it


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1)


class ReviewIn(BaseModel):
    passed: bool
    evidence: str = Field(min_length=1)


class Verdict(BaseModel):
    id: str
    node: str
    reviewer: str
    producer: str  # "tests", "metric:<name>", "judge", "review", "human"
    provider: str | None
    passed: bool | None
    evidence: str


class Job(BaseModel):
    id: str
    kind: JobKind
    node: str | None
    state: JobState


class Metric(BaseModel):
    name: str
    direction: Literal["max", "min"]
    weight: float


class MainHead(BaseModel):
    commit: str
    node: str


class FrontierEntry(BaseModel):
    node: str
    rank: int
    delta: float
    interval: tuple[float, float]
    intent: str
    author: str
    ref: str


class ClaimEntry(BaseModel):
    lease: str
    by: str
    scope: list[str]
    intent: str
    since: str


class TriedEntry(BaseModel):
    node: str
    intent: str
    scope: list[str]
    state: NodeState
    outcome: Outcome | None
    reason: str | None
    at: str  # lets the server expire old labels (report: "tried" labels expire)


class Rules(BaseModel):
    pinned: list[str]
    requirements_by_path: dict[str, list[str]]


class Update(BaseModel):
    subject: str  # node or lease id
    event: str
    at: str


class Mine(BaseModel):
    leases: list[ClaimEntry]
    updates: list[Update]  # events about this actor's objects since its last context call


class Summary(BaseModel):
    status: Literal["pending", "ready"]
    text: str | None
    job: str | None


class Context(BaseModel):
    goal: str
    metrics: list[Metric]
    main: MainHead
    frontier: list[FrontierEntry]
    claims: list[ClaimEntry]
    tried: list[TriedEntry]
    rules: Rules
    mine: Mine
    frontier_version: int
    summary: Summary | None  # only when asked for with --summary
