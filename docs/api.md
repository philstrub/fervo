# HTTP API

Everything the CLI and the runner do goes through this API. Use it to write a client in another language, or a harness adapter that does not shell out to `fervo`. A TypeScript client can import the request and response schemas as zod objects from `fervo` (`import { ClaimIn, ClaimOut } from 'fervo'`); every schema named below is one of those exports. Clients in other languages use the same schemas as JSON Schema (draft 2020-12), one file per name in [`docs/schemas/`](schemas/): `docs/schemas/ClaimIn.json` and so on. They allow unknown properties: the server ignores unknown request fields, and later versions may add response fields.

## Conventions

- **Base URL**: the server's `--public-url`. Requests and responses are JSON.
- **Authentication**: `Authorization: Bearer <token>` on every request except `GET /healthz`. A token that is unknown or belongs to a disabled actor gets 401.
- **Writes are idempotent**: every `POST` needs an `Idempotency-Key` header. The server stores the key, a hash of the request and the response in the same transaction as the write. The same key with the same body returns the stored response, with `token` and `grant` replaced by `null`; the same key with a different body is 409. Keys are per actor.
- **Bodies** over 1 MB are refused with 413. Git pushes are streamed and have no limit.
- **Errors** are `{"error": "<message>"}` with a status: 400 malformed input, 401 bad token, 403 the actor's kind or ownership forbids it, 404 unknown object or route, 409 the object's state forbids it (or a reused key, or an `id` that exists), 413 body too large, 500 a server bug, logged with its stack. The [CLI reference](cli.md#errors) lists the messages and what to do about each.
- **Long polls**: `GET /status/:id?wait=<s>` and `POST /jobs/lease` with `{"wait": <s>}` hold the request up to 30 s until something changes. A poll whose client disconnects stops.

## Routes

Who: **any** is any valid token; **contributor** is an agent or a human; **author** is the node's author.

### Identity and actors

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /healthz` | no token | | `{}` |
| `GET /whoami` | any | | `Whoami`: the actor, the Git URL, and the branch prefix it may push to |
| `GET /actors` | human | | `Actor[]` |
| `POST /actors` | human | `ActorIn` | `ActorCreated`: the actor and its token, shown once |
| `POST /actors/:id/disable` | human | `{}` | `Actor` |
| `POST /enrollers` | human | `EnrollerIn` | `ActorCreated`: an enroller owned by the human, for a human clone |
| `POST /grants` | human | `{}` | `Grant`: a code, valid 12 h, that lets one session enroll with human powers |
| `POST /enroll` | enroller | `EnrollIn` | `ActorCreated`: the session's actor, `<owner>-<session>`; a repeat rotates its token |

### Claims and nodes

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /context?scope=<path>…` | any | | `Context`: goal, metrics, `main`, frontier, active claims, recent tries, rules, the caller's own leases and updates |
| `POST /claims` | contributor | `ClaimIn` | `ClaimOut`: lease, branch to push, parent commit, `blocked` pinned paths, `overlaps` |
| `POST /claims/:lease/renew` | holder | `{}` | `Claim`, two more hours |
| `POST /claims/:lease/release` | holder | `{}` | `Claim` |
| `POST /submit` | holder | `SubmitIn` | `SubmitOut`: the node, and its eval job unless it was rejected |
| `GET /status/:id?wait=<0-30>` | any | | `Status`: a `NodeStatus`, `ClaimStatus` or `Job`, by the id's prefix (`n_`, `l_`, `j_`) |
| `POST /nodes/:id/retry` | author or human | `{}` | `NodeStatus`; a failed node, or a verified node whose review failed |
| `POST /nodes/:id/abandon` | author or human | `ReasonIn` | `NodeStatus` |
| `POST /nodes/:id/verdicts` | human | `ReviewIn` | `Verdict`: the human's review, which policy then evaluates |
| `POST /nodes/:id/merge` | human | `ReasonIn` | `NodeStatus`; needs `human_override` in `fervo.toml` |
| `POST /nodes/:id/veto` | human | `ReasonIn` | `NodeStatus` |
| `POST /nodes/:id/revert` | human | `ReasonIn` | `NodeStatus`; only the head of `main` |
| `POST /baseline` | human | `{}` | `Job`: a new baseline measurement of `main` |

On a node that changes a pinned path, `verdicts`, `merge` and `revert` need a human's own token, not a `fervo delegate` session's ([Change the policy](operating.md#change-the-policy)).

### Runner

| Method and path | Who | Request | Response |
|---|---|---|---|
| `POST /jobs/lease` | runner | `{"wait": 0-30}` | `LeaseJob` or `null`; the lease lasts 90 s |
| `POST /jobs/:id/heartbeat` | the runner holding it | `{}` | `Job`; extends the lease by 90 s |
| `POST /jobs/:id/result` | the runner holding it | `JobResult` | `Job` |

A job leased three times without a result fails. A `LeaseJob` carries the commits to check out, the intent and scope, the author and the author's provider, and the baselines.

### Events

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /events?after=<seq>` | human | | `Event[]` after `seq`, in order: `{seq, at, actor, type, subject, data}` |

Read from a cursor: pass the last `seq` you processed as `after`. Events are never rewritten or deleted.

### Git

`/git/repo.git` is Git smart HTTP with the same bearer token (`git -c http.extraHeader="Authorization: Bearer <token>"`; `fervo clone` stores it). Every token may fetch, runner and enroller tokens included. Agents push only to `refs/heads/agents/<id>/…` and humans only to `refs/heads/humans/<id>/…`; the server alone moves `main`.
