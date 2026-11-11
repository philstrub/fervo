/**
# API Contract

Validated JSON exchanged by the CLI, server, and runner.

## 1. What This Module Does
Defines the requests and responses for the agent and operator commands.
## 2. Why This Module Exists
A shared runtime schema makes an API mismatch fail at the process boundary.
## 3. How It Fits in the Architecture
The CLI validates server output; future server and runner code use the same schemas.
## 4. Key Concepts
Claims reserve intent and scope; nodes identify submitted commits. Writes carry idempotency keys in HTTP headers.
## 5. HTTP Surface
GET /whoami, /context, /status/:id, and /events (human only, `after` sequence query) are reads. Status accepts a bounded `wait` query in seconds.
POST /claims, /submit, /baseline, /actors, and actor/claim/node action paths are writes.
A new claim can name `supersedes` when the target moved; submit uses its new lease.
## 6. Enrollment
A human clone holds an `enroller` token, never the human's own. POST /enrollers (human) mints one;
POST /enroll (enroller) gives a harness session its own actor, `agent` by default or `human` with a
grant from POST /grants (human). Responses that carry a `token` or `grant` are stored for replay with
that field set to null, so the database never holds a usable secret.
*/
import { z } from 'zod';

const id = z.string().min(1);
const pathList = z.array(z.string().min(1));
export const ActorKind = z.enum(['human', 'agent', 'runner', 'enroller', 'system']);
export const Actor = z.object({ id, kind: ActorKind, provider: z.string().nullable(), model: z.string().nullable(), harness: z.string().nullable(), owner: z.string().nullable(), session: z.string().nullable(), disabled: z.boolean() });
export const ActorIn = Actor.pick({ id: true, kind: true, provider: true, model: true, harness: true }).extend({ id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), kind: z.enum(['human', 'agent', 'runner']) });
export const ActorCreated = z.object({ actor: Actor, token: id.nullable() });
export const Whoami = z.object({ actor: Actor, git_url: z.string().min(1), branch_prefix: z.string().nullable() });
export const EnrollerIn = z.object({ provider: id, harness: id });
export const EnrollIn = z.object({ session: z.string().regex(/^[A-Za-z0-9-]{8,}$/), model: z.string().nullable(), grant: id.optional() });
export const Grant = z.object({ grant: id.nullable(), expires_at: id });
export const ClaimIn = z.object({ parent: id, supersedes: id.optional(), scope: pathList.min(1), intent: id });
export const Overlap = z.object({ kind: z.enum(['claim', 'node']), id, by: id, scope: pathList, intent: id });
export const ClaimOut = z.object({ lease: id, branch: id, parent: id, parent_commit: id, parent_ref: id, expires_at: id, blocked: pathList, overlaps: z.array(Overlap), review_job: id.nullable().optional() });
export const Claim = z.object({ lease: id, holder: id, parent: id, supersedes: id.nullable().optional(), intent: id, scope: pathList, state: z.enum(['active', 'submitted', 'expired', 'released']), expires_at: id });
export const SubmitIn = z.object({ lease: id, commit: id });
export const SubmitOut = z.object({ node: id, job: id.nullable() });
export const NodeState = z.enum(['submitted', 'evaluating', 'verified', 'merged', 'reverted', 'rejected', 'failed', 'abandoned']);
export const Outcome = z.enum(['improved', 'within_noise', 'worse']);
export const NextAction = z.enum(['wait', 'rebase', 'retry', 'release', 'stop']);
export const NodeStatus = z.object({ node: id, state: NodeState, outcome: Outcome.nullable(), delta: z.number().nullable(), interval: z.tuple([z.number(), z.number()]).nullable(), rank: z.number().int().nullable(), reason: z.string().nullable(), job: id.nullable(), next_action: NextAction });
export const ClaimStatus = z.object({ lease: id, state: Claim.shape.state, expires_at: id, review_job: id.nullable(), review: z.enum(['pending', 'passed', 'failed']).nullable(), reason: z.string().nullable(), next_action: NextAction });
export const Job = z.object({ id, kind: z.enum(['claim_review', 'eval', 'review', 'summary', 'postmerge', 'baseline']), node: id.nullable(), claim: id.nullable().optional(), state: z.enum(['queued', 'running', 'done', 'failed']) });
export const LeaseJob = Job.extend({ commit: id.nullable(), parent_commit: id.nullable(), intent: z.string().nullable(), scope: pathList.nullable(), author_provider: z.string().nullable(), baselines: z.record(z.string(), z.object({ mean: z.number(), sd: z.number() })) });
export const RunnerVerdict = z.object({ producer: id, provider: z.string().nullable(), passed: z.boolean().nullable(), samples: z.array(z.number()).nullable(), noise: z.number().nonnegative().optional(), evidence: z.string(), recipe_hash: id });
export const JobResult = z.object({ verdicts: z.array(RunnerVerdict), error: z.string().optional() });
export const Status = z.union([NodeStatus, ClaimStatus, Job]);
export const ReasonIn = z.object({ reason: id });
export const ReviewIn = z.object({ passed: z.boolean(), evidence: id });
export const Verdict = z.object({ id, node: id.nullable(), claim: id.nullable().optional(), reviewer: id, producer: id, provider: z.string().nullable(), passed: z.boolean().nullable(), evidence: z.string() });
export const Metric = z.object({ name: id, direction: z.enum(['max', 'min']), weight: z.number() });
export const MainHead = z.object({ commit: id, node: id, score: z.number().optional() });
export const FrontierEntry = z.object({ node: id, rank: z.number().int().optional(), score: z.number().optional(), delta: z.number().optional(), interval: z.tuple([z.number(), z.number()]), intent: id, author: id, ref: id });
export const ClaimEntry = z.object({ lease: id, by: id, scope: pathList, intent: id, since: id });
export const TriedEntry = z.object({ node: id, intent: id, scope: pathList.optional(), state: NodeState.optional(), outcome: Outcome.nullable(), reason: z.string().nullable().optional(), at: id.optional() });
export const Rules = z.object({ pinned: pathList, requirements_by_path: z.record(z.string(), pathList) });
export const Update = z.object({ subject: id, event: id, at: id });
export const Event = z.object({ seq: z.number().int(), at: id, actor: id, type: id, subject: id, data: z.record(z.string(), z.unknown()) });
export const Mine = z.object({ leases: z.array(ClaimEntry), updates: z.array(Update) });
export const Summary = z.object({ status: z.enum(['pending', 'ready']), text: z.string().nullable(), job: id.nullable() });
export const Context = z.object({ goal: z.string(), metrics: z.array(Metric), main: MainHead, frontier: z.array(FrontierEntry), claims: z.array(ClaimEntry), tried: z.array(TriedEntry), rules: Rules, mine: Mine, frontier_version: z.number().int(), summary: Summary.nullable().optional() });

export type Remote = { url: string; auth: string };
