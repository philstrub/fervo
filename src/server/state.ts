/**
# Server State Transitions

The single writer for claims, nodes, jobs, verdicts, and merge decisions.

## 1. What This Module Does
Applies authenticated API actions and records every lifecycle change.
## 2. Why This Module Exists
Agents need replayable writes and a consistent view of Git and policy state.
## 3. How It Fits in the Architecture
The HTTP boundary validates input and calls these synchronous SQLite transactions.
## 4. Key Concepts
Typed IDs identify objects; events provide an audit cursor; main advances by Git compare-and-swap.
## 5. Enrollment
A human clone holds an enroller token. Each harness session calls `/enroll` with its session id and
becomes the actor `<owner>-<first 12 session characters>`, inheriting the enroller's provider and
harness so a session cannot pick its own judge. Enrolling a known session (resume, compaction) rotates
that actor's token. A session is `human` only with an unexpired grant from its owner, and its kind
never changes afterwards.
*/
import { randomBytes, createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { minimatch } from 'minimatch';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { mainConfig, duration } from '../config.js';
import { ActorIn, ClaimIn, EnrollerIn, EnrollIn, JobResult, ReasonIn, ReviewIn, SubmitIn } from '../models.js';
import { requirements, matches, scopesOverlap } from '../policy.js';
import { summarize } from '../scoring.js';
import { builtInPolicyRules } from '../plugins.js';
import { bareGit } from './git.js';

type Row = Record<string, any>;
const newId = (prefix: string) => `${prefix}_${randomBytes(5).toString('hex')}`;
const now = () => new Date().toISOString();
const json = (value: unknown) => JSON.stringify(value);
const sha = (secret: string) => createHash('sha256').update(secret).digest('hex');

export class State {
  constructor(readonly db: Database.Database, readonly repo: string, readonly root: string) {}
  one(sql: string, ...args: unknown[]): Row { const row = this.db.prepare(sql).get(...args) as Row | undefined; if (!row) throw new Error('object not found'); return row; }
  event(actor: string, type: string, subject: string, data: unknown = {}): void { this.db.prepare('INSERT INTO events(at,actor,type,subject,data) VALUES(?,?,?,?,?)').run(now(), actor, type, subject, json(data)); }
  expire():void {for(const claim of this.db.prepare("SELECT id FROM claims WHERE state='active' AND expires_at<=?").all(now()) as Row[]){this.db.prepare("UPDATE claims SET state='expired' WHERE id=?").run(claim.id);this.event('system','claim_expired',claim.id);}}
  job(kind: string, node: string | null, claim: string | null): string { const id = newId('j'); this.db.prepare('INSERT INTO jobs(id,kind,node,claim,payload,state,created_at) VALUES(?,?,?,?,?,?,?)').run(id,kind,node,claim,'{}','queued',now()); this.event('system', 'job_queued', id, { kind, node, claim }); return id; }
  actor(row: Row): object { return { id: row.id, kind: row.kind, provider: row.provider, model: row.model, harness: row.harness, owner: row.owner ?? null, session: row.session ?? null, disabled: Boolean(row.disabled) }; }
  branchPrefix(actor: Row): string | null { return actor.kind === 'agent' ? `agents/${actor.id}` : actor.kind === 'human' ? `humans/${actor.id}` : null; }
  status(id: string): object {
    if (id.startsWith('l_')) {
      const claim = this.one('SELECT * FROM claims WHERE id=?', id);
      const reviewJob = this.db.prepare("SELECT id,state FROM jobs WHERE claim=? AND kind='claim_review' ORDER BY created_at DESC LIMIT 1").get(id) as Row | undefined;
      const review = this.db.prepare("SELECT passed,evidence FROM verdicts WHERE claim=? AND producer='claim_review' ORDER BY created_at DESC LIMIT 1").get(id) as Row | undefined;
      return { lease: id, state: claim.state, expires_at: claim.expires_at, review_job: reviewJob?.id ?? null, review: review ? (review.passed ? 'passed' : 'failed') : reviewJob ? 'pending' : null, reason: review?.evidence ?? null, next_action: claim.state === 'active' ? 'wait' : 'stop' };
    }
    if (id.startsWith('j_')) { const job = this.one('SELECT * FROM jobs WHERE id=?', id); return { id, kind: job.kind, node: job.node, claim: job.claim, state: job.state }; }
    const node = this.one('SELECT * FROM nodes WHERE id=?', id);
    const parent=node.parent_node?this.one('SELECT score_mean FROM nodes WHERE id=?',node.parent_node):null;
    const job = this.db.prepare('SELECT id FROM jobs WHERE node=? ORDER BY created_at DESC LIMIT 1').get(id) as Row | undefined;
    const action = node.reason === 'needs_rebase' ? 'rebase' : node.reason&&node.state==='verified' ? 'stop' : ['submitted','evaluating'].includes(node.state) || node.state==='verified'&&node.outcome==='improved' ? 'wait' : node.state === 'failed' ? 'retry' : 'stop';
    const ranked=this.db.prepare("SELECT id FROM nodes WHERE state='verified' AND outcome='improved' AND reason IS NULL ORDER BY score_mean DESC").all() as {id:string}[];
    const position=ranked.findIndex(entry=>entry.id===id);
    return { node: id, state: node.state, outcome: node.outcome, delta: node.score_mean===null||parent===null?null:node.score_mean-parent.score_mean, interval: node.score_lo === null ? null : [node.score_lo, node.score_hi], rank: position<0?null:position+1, reason: node.reason, job: job?.id ?? null, next_action: action };
  }
  context(actor: string, scopes: string[]): object {
    const config = mainConfig(this.repo);
    const head = this.one("SELECT * FROM nodes WHERE merged_as=? ORDER BY created_at DESC LIMIT 1", bareGit(this.repo,'rev-parse','refs/heads/main'));
    const files = bareGit(this.repo,'ls-tree','-r','--name-only','refs/heads/main').split('\n');
    const active = this.db.prepare("SELECT * FROM claims WHERE state='active' AND expires_at>? ORDER BY created_at DESC LIMIT 20").all(now()) as Row[];
    const claims = active.filter(c => !scopes.length || scopesOverlap(scopes, JSON.parse(c.scope), files)).map(c => ({ lease:c.id, by:c.holder, scope:JSON.parse(c.scope), intent:c.intent, since:c.created_at }));
    const tried = (this.db.prepare("SELECT *, COALESCE((SELECT MAX(at) FROM events WHERE subject=nodes.id AND type IN ('node_state','node_merged','node_reverted')),created_at) AS outcome_at FROM nodes WHERE id!='n_0' AND outcome_at>? ORDER BY outcome_at DESC LIMIT 20").all(new Date(Date.now()-duration(config.context.tried_ttl)*1000).toISOString()) as Row[]).filter(n => !scopes.length || scopesOverlap(scopes,JSON.parse(n.scope),files)).map(n => ({ node:n.id,intent:n.intent,scope:JSON.parse(n.scope),state:n.state,outcome:n.outcome,reason:n.reason,at:n.outcome_at }));
    const frontier = (this.db.prepare("SELECT * FROM nodes WHERE state='verified' AND outcome='improved' AND reason IS NULL ORDER BY score_mean DESC LIMIT 10").all() as Row[]).filter(n => !this.db.prepare("SELECT 1 FROM nodes WHERE parent_node=? AND outcome='improved' AND state IN ('verified','merged') LIMIT 1").get(n.id)).map((n,index) => ({ node:n.id,rank:index+1,score:n.score_mean,delta:n.score_mean-this.one('SELECT score_mean FROM nodes WHERE id=?',n.parent_node).score_mean,interval:[n.score_lo,n.score_hi],intent:n.intent,author:n.author,ref:`refs/fervo/nodes/${n.id}` }));
    const updates = (this.db.prepare('SELECT events.* FROM events LEFT JOIN nodes ON events.subject=nodes.id WHERE events.actor=? OR nodes.author=? ORDER BY events.seq DESC LIMIT 20').all(actor,actor) as Row[]).map(e => ({subject:e.subject,event:e.type,at:e.at}));
    const version = (this.one("SELECT COALESCE(MAX(seq),0) AS seq FROM events WHERE type IN ('claim_created','node_submitted','node_state','node_merged')")).seq;
    const mine=(this.db.prepare("SELECT * FROM claims WHERE holder=? AND state='active' ORDER BY created_at DESC LIMIT 20").all(actor) as Row[]).map(c=>({lease:c.id,by:c.holder,scope:JSON.parse(c.scope),intent:c.intent,since:c.created_at}));
    return { goal:config.goal.text, metrics:config.metrics.map(m=>({name:m.name,direction:m.direction,weight:m.weight})), main:{commit:head.commit_sha,node:head.id,score:head.score_mean ?? undefined}, frontier, claims, tried, rules:{pinned:config.pinned.paths,requirements_by_path:{'*':config.merge.main.require,...Object.fromEntries(config.merge.rules.flatMap(r=>r.paths.map(p=>[p,r.require])))}}, mine:{leases:mine,updates}, frontier_version:version };
  }
  write(actor: Row, path: string, raw: unknown): object {
    const config = mainConfig(this.repo);
    if (path === '/actors') {
      this.human(actor); const body=ActorIn.parse(raw); const token=randomBytes(32).toString('hex');
      this.db.prepare('INSERT INTO actors(id,kind,provider,model,harness,token_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(body.id,body.kind,body.provider,body.model,body.harness,createHash('sha256').update(token).digest('hex'),now());
      this.event(actor.id,'actor_created',body.id); return {actor:this.actor({...body,disabled:0}),token};
    }
    if (path === '/enrollers') {
      this.human(actor); const body=EnrollerIn.parse(raw); const token=randomBytes(32).toString('hex'); const owner=actor.owner ?? actor.id; const id=`${owner}-clone-${randomBytes(3).toString('hex')}`;
      this.db.prepare('INSERT INTO actors(id,kind,provider,model,harness,owner,token_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,'enroller',body.provider,null,body.harness,owner,sha(token),now());
      this.event(actor.id,'actor_created',id); return {actor:this.actor(this.one('SELECT * FROM actors WHERE id=?',id)),token};
    }
    if (path === '/grants') {
      this.human(actor); const grant=randomBytes(32).toString('hex'); const expiry=new Date(Date.now()+12*3600_000).toISOString(); const owner=actor.owner ?? actor.id;
      this.db.prepare('INSERT INTO grants(code_hash,owner,expires_at,created_at) VALUES(?,?,?,?)').run(sha(grant),owner,expiry,now());
      this.event(actor.id,'grant_created',owner,{expires_at:expiry}); return {grant,expires_at:expiry};
    }
    if (path === '/enroll') {
      if (actor.kind !== 'enroller') throw new Error('enroller token required');
      const body=EnrollIn.parse(raw);
      if (!this.db.prepare('SELECT 1 FROM actors WHERE id=? AND disabled=0').get(actor.owner)) throw new Error('the human who owns this clone is disabled');
      if (body.grant !== undefined && !this.db.prepare('SELECT 1 FROM grants WHERE code_hash=? AND owner=? AND expires_at>?').get(sha(body.grant),actor.owner,now())) throw new Error('grant is invalid or expired');
      const kind=body.grant === undefined ? 'agent' : 'human';
      const id=`${actor.owner}-${body.session.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12)}`;
      const existing=this.db.prepare('SELECT * FROM actors WHERE id=?').get(id) as Row | undefined;
      const token=randomBytes(32).toString('hex');
      if (existing) {
        if (existing.session !== body.session || existing.owner !== actor.owner) throw new Error('session id collides with another actor');
        if (existing.disabled) throw new Error('session actor is disabled');
        if (existing.kind !== kind) throw new Error(existing.kind === 'human' ? 'human session: resume it through fervo delegate' : 'agent session cannot gain human powers');
        this.db.prepare('UPDATE actors SET token_hash=?,model=? WHERE id=?').run(sha(token),body.model,id);
      } else this.db.prepare('INSERT INTO actors(id,kind,provider,model,harness,owner,session,token_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,kind,actor.provider,body.model,actor.harness,actor.owner,body.session,sha(token),now());
      this.event(actor.id,existing?'actor_rotated':'actor_enrolled',id,{kind}); return {actor:this.actor(this.one('SELECT * FROM actors WHERE id=?',id)),token};
    }
    if (path === '/baseline') { this.human(actor); const id=this.job('baseline',null,null); return this.status(id); }
    if (path === '/claims') {
      if (actor.kind !== 'agent' && actor.kind !== 'human') throw new Error('only contributors can claim');
      const body=ClaimIn.parse(raw); const parent=this.one('SELECT * FROM nodes WHERE id=?',body.parent);
      if (!['merged','verified'].includes(parent.state)) throw new Error('parent must be merged or verified');
      if (body.supersedes) { const old=this.one('SELECT * FROM nodes WHERE id=?',body.supersedes); if(old.author!==actor.id || body.parent!==this.currentMainNode()) throw new Error('supersedes must name your node and current main parent'); }
      const files=bareGit(this.repo,'ls-tree','-r','--name-only',parent.commit_sha).split('\n');
      const active=this.db.prepare("SELECT * FROM claims WHERE state='active' AND expires_at>?").all(now()) as Row[];
      const overlapClaims=active.filter(c=>scopesOverlap(body.scope,JSON.parse(c.scope),files)).map(c=>({kind:'claim',id:c.id,by:c.holder,scope:JSON.parse(c.scope),intent:c.intent}));
      const recent=this.db.prepare("SELECT * FROM nodes WHERE id!='n_0' AND created_at>? ORDER BY created_at DESC LIMIT 20").all(new Date(Date.now()-duration(config.context.tried_ttl)*1000).toISOString()) as Row[];
      const overlapNodes=recent.filter(n=>scopesOverlap(body.scope,JSON.parse(n.scope),files)).map(n=>({kind:'node',id:n.id,by:n.author,scope:JSON.parse(n.scope),intent:n.intent}));
      const overlaps=[...overlapClaims,...overlapNodes];
      const id=newId('l'); const expiry=new Date(Date.now()+7200_000).toISOString();
      this.db.prepare('INSERT INTO claims(id,holder,parent_node,supersedes,intent,scope,state,overlaps_at_grant,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,actor.id,body.parent,body.supersedes ?? null,body.intent,json(body.scope),'active',json(overlaps),expiry,now());
      this.event(actor.id,'claim_created',id,{overlaps});
      const reviewJob=config.claim_review?.enabled?this.job('claim_review',null,id):null;
      return {lease:id,branch:`${this.branchPrefix(actor)}/${id}`,parent:body.parent,parent_commit:parent.commit_sha,parent_ref:body.parent==='n_0'?'refs/heads/main':`refs/fervo/nodes/${body.parent}`,expires_at:expiry,blocked:config.pinned.paths,overlaps,review_job:reviewJob};
    }
    if (path === '/submit') {
      const body=SubmitIn.parse(raw); const claim=this.one('SELECT * FROM claims WHERE id=?',body.lease);
      if(claim.holder!==actor.id || claim.state!=='active' || claim.expires_at<=now()) throw new Error('lease is not active for actor');
      if(this.db.prepare("SELECT 1 FROM jobs WHERE claim=? AND kind='claim_review'").get(claim.id)&&!this.db.prepare("SELECT 1 FROM verdicts WHERE claim=? AND producer='claim_review' AND passed=1").get(claim.id))throw new Error('claim review has not passed');
      const parent=this.one('SELECT * FROM nodes WHERE id=?',claim.parent_node);
      const branch=`refs/heads/${this.branchPrefix(actor)}/${claim.id}`;
      if(bareGit(this.repo,'rev-parse',branch)!==body.commit) throw new Error('submitted commit is not the pushed lease branch');
      const ancestry=spawnGit(this.repo,'merge-base','--is-ancestor',parent.commit_sha,body.commit);
      const paths=bareGit(this.repo,'diff','--name-only',parent.commit_sha,body.commit).split('\n').filter(Boolean);
      const pinned=paths.filter(p=>config.pinned.paths.some(pattern=>matches(p,pattern)));
      const state=ancestry && !pinned.length?'submitted':'rejected';
      const reason=!ancestry?'commit does not descend from parent':pinned.length?`touched pinned paths: ${pinned.join(', ')}`:null;
      const id=newId('n');
      this.db.prepare('INSERT INTO nodes(id,commit_sha,parent_node,claim,author,intent,scope,changed_paths,state,reason,supersedes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,body.commit,parent.id,claim.id,actor.id,claim.intent,claim.scope,json(paths),state,reason,claim.supersedes,now());
      bareGit(this.repo,'update-ref',`refs/fervo/nodes/${id}`,body.commit);
      this.db.prepare("UPDATE claims SET state='submitted' WHERE id=?").run(claim.id);
      this.event(actor.id,'node_submitted',id,{state,reason,paths});
      const job=state==='submitted'?this.job('eval',id,null):this.job('review',id,null);
      if(state==='rejected') this.db.prepare("UPDATE jobs SET state='done' WHERE id=?").run(job);
      return {node:id,job};
    }
    const release=/^\/claims\/(l_[^/]+)\/release$/.exec(path);
    if(release){const c=this.one('SELECT * FROM claims WHERE id=?',release[1]);if(c.holder!==actor.id||c.state!=='active')throw new Error('claim cannot be released');this.db.prepare("UPDATE claims SET state='released' WHERE id=?").run(c.id);this.event(actor.id,'claim_released',c.id);return {lease:c.id,holder:c.holder,parent:c.parent_node,supersedes:c.supersedes,intent:c.intent,scope:JSON.parse(c.scope),state:'released',expires_at:c.expires_at};}
    const renew=/^\/claims\/(l_[^/]+)\/renew$/.exec(path);
    if(renew){const c=this.one('SELECT * FROM claims WHERE id=?',renew[1]);if(c.holder!==actor.id||c.state!=='active')throw new Error('claim cannot be renewed');const expiry=new Date(Date.now()+7200_000).toISOString();this.db.prepare('UPDATE claims SET expires_at=? WHERE id=?').run(expiry,c.id);this.event(actor.id,'claim_renewed',c.id);return {lease:c.id,holder:c.holder,parent:c.parent_node,supersedes:c.supersedes,intent:c.intent,scope:JSON.parse(c.scope),state:'active',expires_at:expiry};}
    const disable=/^\/actors\/([^/]+)\/disable$/.exec(path);
    if(disable){this.human(actor);this.db.prepare('UPDATE actors SET disabled=1 WHERE id=?').run(disable[1]);this.event(actor.id,'actor_disabled',disable[1]!);return this.actor(this.one('SELECT * FROM actors WHERE id=?',disable[1]));}
    const action=/^\/nodes\/(n_[^/]+)\/(merge|veto|revert|abandon|retry|verdicts)$/.exec(path);
    if(action){const node=this.one('SELECT * FROM nodes WHERE id=?',action[1]);const command=action[2];
      if(command==='retry'){if(actor.id!==node.author&&actor.kind!=='human')throw new Error('only author or human may retry');if(node.state!=='failed')throw new Error('only failed nodes can retry');this.db.prepare("UPDATE nodes SET state='submitted',reason=NULL WHERE id=?").run(node.id);this.job('eval',node.id,null);this.event(actor.id,'node_retry',node.id);return this.status(node.id);}
      if(command==='verdicts'){this.human(actor);const b=ReviewIn.parse(raw);this.verdict(node.id,null,actor.id,'human',null,b.passed,null,b.evidence,'human');this.event(actor.id,'human_review',node.id,{passed:b.passed});this.policy(node.id);const verdict=this.one('SELECT * FROM verdicts WHERE node=? ORDER BY created_at DESC LIMIT 1',node.id);return {id:verdict.id,node:node.id,claim:null,reviewer:actor.id,producer:'human',provider:null,passed:b.passed,evidence:b.evidence};}
      const reason=ReasonIn.parse(raw).reason;
      if((command==='abandon'||command==='veto')&&!['submitted','evaluating','verified','failed'].includes(node.state))throw new Error(node.state==='merged'?'node is merged: revert it instead':`node is already ${node.state}`);
      if(command==='abandon'){if(actor.id!==node.author&&actor.kind!=='human')throw new Error('only author or human may abandon');this.db.prepare("UPDATE nodes SET state='abandoned',reason=? WHERE id=?").run(reason,node.id);}
      else {this.human(actor);if(command==='merge'){if(!config.merge.main.human_override)throw new Error('human override disabled');this.merge(node.id,reason);}else if(command==='veto'){this.db.prepare("UPDATE nodes SET state='abandoned',reason=? WHERE id=?").run(reason,node.id);}else if(command==='revert'){this.revert(node.id,reason);}}
      this.verdict(node.id,null,actor.id,'human',null,command==='merge',null,reason,'override');this.event(actor.id,`human_${command}`,node.id,{reason});return this.status(node.id);
    }
    throw new Error(`unknown write path ${path}`);
  }
  human(actor: Row): void { if(actor.kind!=='human')throw new Error('human token required'); }
  currentMainNode(): string { return this.one('SELECT id FROM nodes WHERE merged_as=?',bareGit(this.repo,'rev-parse','refs/heads/main')).id; }
  verdict(node:string|null,claim:string|null,reviewer:string,producer:string,provider:string|null,passed:boolean|null,samples:number[]|null,evidence:string,recipe:string):void {this.db.prepare('INSERT INTO verdicts(id,node,claim,reviewer,producer,provider,passed,samples,evidence,recipe_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(newId('v'),node,claim,reviewer,producer,provider,passed===null?null:Number(passed),samples===null?null:json(samples),evidence,recipe,now());}
  lease(actor:Row):object|null {
    if(actor.kind!=='runner')throw new Error('runner token required');
    const job=this.db.prepare("SELECT * FROM jobs WHERE state='queued' OR (state='running' AND lease_until<?) ORDER BY created_at LIMIT 1").get(now()) as Row|undefined;
    if(!job)return null;
    if(job.attempts>=3){
      this.db.prepare("UPDATE jobs SET state='failed',result='lease attempts exhausted' WHERE id=?").run(job.id);
      if(job.node){
        if(job.kind==='postmerge'||job.kind==='review')this.db.prepare('UPDATE nodes SET reason=? WHERE id=?').run(`${job.kind} lease attempts exhausted`,job.node);
        else this.db.prepare("UPDATE nodes SET state='failed',reason='job lease attempts exhausted' WHERE id=?").run(job.node);
      }
      this.event(actor.id,'job_failed',job.id);
      return null;
    }
    this.db.prepare("UPDATE jobs SET state='running',runner=?,lease_until=?,attempts=attempts+1 WHERE id=?").run(actor.id,new Date(Date.now()+90_000).toISOString(),job.id);
    if(job.node)this.db.prepare("UPDATE nodes SET state='evaluating' WHERE id=? AND state='submitted'").run(job.node);
    this.event(actor.id,'job_leased',job.id);
    const node=job.node?this.one('SELECT * FROM nodes WHERE id=?',job.node):null;
    const claim=job.claim?this.one('SELECT * FROM claims WHERE id=?',job.claim):null;
    const parent=node?.parent_node?this.one('SELECT * FROM nodes WHERE id=?',node.parent_node):null;
    const baselineRows=this.db.prepare('SELECT * FROM baselines').all() as Row[];
    return {id:job.id,kind:job.kind,node:job.node,claim:job.claim,state:'running',commit:node?.commit_sha??bareGit(this.repo,'rev-parse','refs/heads/main'),parent_commit:parent?.commit_sha??null,intent:node?.intent??claim?.intent??null,scope:node?JSON.parse(node.scope):claim?JSON.parse(claim.scope):null,author_provider:node?this.one('SELECT provider FROM actors WHERE id=?',node.author).provider:null,baselines:Object.fromEntries(baselineRows.map(b=>[b.metric,{mean:b.mean,sd:b.sd}]))};
  }
  heartbeat(actor:Row,id:string):object {const job=this.one('SELECT * FROM jobs WHERE id=?',id);if(job.runner!==actor.id||job.state!=='running')throw new Error('job lease not held');this.db.prepare('UPDATE jobs SET lease_until=? WHERE id=?').run(new Date(Date.now()+90_000).toISOString(),id);return this.status(id);}
  result(actor:Row,id:string,raw:unknown):object {const job=this.one('SELECT * FROM jobs WHERE id=?',id);if(actor.kind!=='runner'||job.runner!==actor.id||job.state!=='running'||job.lease_until<=now())throw new Error('job lease not held');const result=JobResult.parse(raw);for(const v of result.verdicts)this.verdict(job.node,job.claim,actor.id,v.producer,v.provider,v.passed,v.samples,v.evidence,v.recipe_hash);this.db.prepare('UPDATE jobs SET state=?,result=? WHERE id=?').run(result.error?'failed':'done',json(result),id);this.event(actor.id,result.error?'job_failed':'job_done',id,{error:result.error});if(job.kind==='baseline'&&!result.error){for(const v of result.verdicts){if(!v.producer.startsWith('metric:')||!v.samples)continue;const mean=v.samples.reduce((a,b)=>a+b,0)/v.samples.length;const sd=Math.sqrt(v.samples.reduce((a,b)=>a+(b-mean)**2,0)/(v.samples.length-1));this.db.prepare('INSERT OR REPLACE INTO baselines(metric,commit_sha,samples,mean,sd,created_at) VALUES(?,?,?,?,?,?)').run(v.producer.slice(7),bareGit(this.repo,'rev-parse','refs/heads/main'),json(v.samples),mean,sd,now());}}
    if(job.node){
      if(result.error){
        if(job.kind==='postmerge')this.db.prepare('UPDATE nodes SET reason=? WHERE id=?').run(`postmerge evaluation failed: ${result.error}`,job.node);
        else if(job.kind==='review')this.db.prepare('UPDATE nodes SET reason=? WHERE id=?').run(`review unavailable: ${result.error}`,job.node);
        else this.db.prepare("UPDATE nodes SET state='failed',reason=? WHERE id=?").run(result.error,job.node);
      }else if(job.kind==='eval'){
        const tests=result.verdicts.find(v=>v.producer==='tests');
        if(!tests?.passed)this.db.prepare("UPDATE nodes SET state='rejected',reason=? WHERE id=?").run(tests?.evidence??'missing tests verdict',job.node);
        else{
          const gain=result.verdicts.find(v=>v.producer==='gain');
          if(!gain?.samples)throw new Error('eval missing gain samples');
          const score=summarize(gain.samples,gain.noise??0);
          const node=this.one('SELECT parent_node FROM nodes WHERE id=?',job.node);
          const parent=this.one('SELECT score_mean FROM nodes WHERE id=?',node.parent_node);
          this.db.prepare("UPDATE nodes SET state='verified',outcome=?,score_mean=?,score_lo=?,score_hi=? WHERE id=?").run(score.outcome,parent.score_mean+score.mean,parent.score_mean+score.lo,parent.score_mean+score.hi,job.node);
          this.policy(job.node);
        }
      }else if(job.kind==='review')this.policy(job.node);
      else if(job.kind==='postmerge'&&result.verdicts.find(v=>v.producer==='tests')?.passed===false){
        const head=bareGit(this.repo,'rev-parse','refs/heads/main');
        if(head===this.one('SELECT commit_sha FROM nodes WHERE id=?',job.node).commit_sha)this.revert(job.node,'postmerge tests failed');
        else{this.db.prepare('UPDATE nodes SET reason=? WHERE id=?').run('postmerge tests failed; main has moved past this node, revert manually',job.node);this.event('system','postmerge_failed',job.node,{head});}
      }
      this.event(actor.id,'node_state',job.node,{state:this.one('SELECT state FROM nodes WHERE id=?',job.node).state});
    }
    return this.status(id);
  }
  policy(id:string):void {
    const node=this.one('SELECT * FROM nodes WHERE id=?',id);
    if(node.state!=='verified')return;
    const config=mainConfig(this.repo);
    const required=requirements(config,JSON.parse(node.changed_paths));
    const verdicts=this.db.prepare('SELECT producer,passed,evidence FROM verdicts WHERE node=?').all(id) as Row[];
    for(const name of required){
      const decision=builtInPolicyRules[name]!.evaluate({outcome:node.outcome},verdicts as {producer:string;passed:number|null;evidence:string}[],config);
      if(decision.state==='failed'){this.db.prepare("UPDATE nodes SET state='rejected',reason=? WHERE id=?").run(decision.reason,id);return;}
      if(decision.state==='hold')return;
      if(decision.state==='pending'){
        if(decision.job&&!this.db.prepare('SELECT 1 FROM jobs WHERE node=? AND kind=?').get(id,decision.job))this.job(decision.job,id,null);
        return;
      }
    }
    this.merge(id,null);
  }
  merge(id:string,reason:string|null):void {const node=this.one('SELECT * FROM nodes WHERE id=?',id);if(node.state!=='verified')throw new Error('node must be verified');const parent=this.one('SELECT * FROM nodes WHERE id=?',node.parent_node);const head=bareGit(this.repo,'rev-parse','refs/heads/main');if(parent.commit_sha!==head){this.db.prepare("UPDATE nodes SET reason='needs_rebase' WHERE id=?").run(id);this.event('system','needs_rebase',id,{head});return;}bareGit(this.repo,'update-ref','refs/heads/main',node.commit_sha,head);this.db.prepare("UPDATE nodes SET state='merged',reason=?,merged_as=? WHERE id=?").run(reason,node.commit_sha,id);this.event('system','node_merged',id,{commit:node.commit_sha});this.job('postmerge',id,null);}
  revert(id:string,reason:string):void {const node=this.one('SELECT * FROM nodes WHERE id=?',id);if(node.state!=='merged')throw new Error('node must be merged');const parent=this.one('SELECT * FROM nodes WHERE id=?',node.parent_node);bareGit(this.repo,'update-ref','refs/heads/main',parent.commit_sha,node.commit_sha);this.db.prepare("UPDATE nodes SET state='reverted',reason=? WHERE id=?").run(reason,id);this.event('system','node_reverted',id,{reason});}
}

function spawnGit(repo:string,...args:string[]):boolean {return spawnSync('git',['--git-dir',repo,...args]).status===0;}
