/**
# Policy Change Tests

A human changes `fervo.toml` through a node; agents and delegated sessions cannot.

## 1. What This Module Does
Submits policy changes from an agent, a delegated session and a human, lands the human's with a human
verdict, and runs the next eval for real to show it uses the new metric weight.
## 2. Why This Module Exists
`fervo.toml` was pinned for everyone, so changing the policy after `init` meant re-initializing.
## 3. How It Fits in the Architecture
Drives `State` directly and runs every leased job with `executeJob` on a mirror of the managed repository.
## 4. Key Concepts
The delegated session is a `human` actor with a `session`: it has human powers over code, not over
policy. Score 10 to 12 against a baseline mean of 10 is a gain of 0.2 per unit weight, so 0.4 proves the
eval used weight 2.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/store/db.js';
import { State } from '../src/server/state.js';
import { bareGit } from '../src/server/git.js';
import { builtinServerExtensions } from '../src/server/extensions.js';
import { executeJob } from '../src/runner/run.js';
import { loadRunnerExtensions } from '../src/runner/extensions.js';
import { LeaseJob } from '../src/models.js';
import { FervoError } from '../src/errors.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('only a human\'s own token changes the policy, a human verdict lands it, and the next eval uses it',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-policy-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests","frontier_gain","review"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root,builtinServerExtensions);const at=new Date().toISOString();
    const insert=db.prepare('INSERT INTO actors(id,kind,owner,session,token_hash,created_at) VALUES(?,?,?,?,?,?)');
    insert.run('human','human',null,null,'human',at);insert.run('human-delegated1','human','human','delegated1-session','delegated',at);insert.run('agent','agent',null,null,'agent',at);insert.run('runner','runner',null,null,'runner',at);
    const actor=(id:string)=>db.prepare('SELECT * FROM actors WHERE id=?').get(id) as Record<string,any>;
    const [human,delegated,agent,runner]=['human','human-delegated1','agent','runner'].map(actor) as [Record<string,any>,Record<string,any>,Record<string,any>,Record<string,any>];
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    db.prepare('INSERT INTO baselines(metric,commit_sha,samples,mean,sd,created_at) VALUES(?,?,?,?,?,?)').run('m',base,'[10,10]',10,1,at);
    const mirror=join(tmp,'mirror.git');git(tmp,'clone','--mirror','-q',state.repo,mirror);
    const extensions=await loadRunnerExtensions({extensions:[],disable:[]},tmp);

    const submit=(by:Record<string,any>,parent:string,edit:()=>void,intent:string)=>{
      const claim=state.write(by,'/claims',{parent,scope:['fervo.toml','score.txt'],intent}) as {lease:string;branch:string;blocked:string[]};
      git(source,'fetch','-q',state.repo,`+${parent==='n_0'?'refs/heads/main':`refs/fervo/nodes/${parent}`}:refs/remotes/fervo/parent`);git(source,'checkout','-q','-B','work','refs/remotes/fervo/parent');
      edit();git(source,'commit','-qam',intent);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/${claim.branch}`);
      const out=state.write(by,'/submit',{lease:claim.lease,commit}) as {node:string;job:string|null};
      return {...out,blocked:claim.blocked,status:()=>state.status(out.node) as {state:string;reason:string|null}};
    };
    const weight=(value:number)=>()=>writeFileSync(join(source,'fervo.toml'),readFileSync(join(source,'fervo.toml'),'utf8').replace(/weight=\d+/,`weight=${value}`));
    // As the runner does: a job that throws (here a review, with no model flags) reports its error.
    const drain=async()=>{for(let job=state.lease(runner);job;job=state.lease(runner)){const leased=LeaseJob.parse(job);state.result(runner,leased.id,await executeJob(leased,mirror,{},extensions).catch((error:Error)=>({verdicts:[],error:error.message})));}};
    const refused=(fn:()=>unknown,message:string)=>assert.throws(fn,(error:unknown)=>error instanceof FervoError&&error.status===403&&error.message===message);

    const byAgent=submit(agent,'n_0',weight(5),'agent raises its own weight');
    assert.deepEqual([byAgent.blocked,byAgent.job,byAgent.status().state,byAgent.status().reason],[['fervo.toml'],null,'rejected','touched pinned paths: fervo.toml']);
    const byDelegate=submit(delegated,'n_0',weight(5),'delegated session raises the weight');
    assert.deepEqual([byDelegate.blocked,byDelegate.job,byDelegate.status().state,byDelegate.status().reason],[['fervo.toml'],null,'rejected','touched pinned paths: fervo.toml (a delegated session cannot change policy)']);

    const policy=submit(human,'n_0',weight(2),'weigh m twice');
    assert.deepEqual([policy.blocked,policy.status().state],[[],'submitted']);
    await drain();
    assert.deepEqual([policy.status().state,policy.status().reason],['verified',null],'tests and human, not frontier_gain or review: it waits for a human verdict');
    refused(()=>state.write(delegated,`/nodes/${policy.node}/verdicts`,{passed:true,evidence:'fine'}),'a delegated session cannot approve a policy change');
    refused(()=>state.write(delegated,`/nodes/${policy.node}/merge`,{reason:'fine'}),'a delegated session cannot approve a policy change');
    state.write(human,`/nodes/${policy.node}/verdicts`,{passed:true,evidence:'weight change reviewed'});
    assert.equal(policy.status().state,'merged');
    assert.match(bareGit(state.repo,'show','refs/heads/main:fervo.toml'),/weight=2/);
    const changed=db.prepare("SELECT subject,data FROM events WHERE type='policy_changed'").all();
    assert.deepEqual(changed,[{subject:policy.node,data:JSON.stringify({paths:['fervo.toml'],baseline:false})}],'a weight change keeps the baselines');
    refused(()=>state.write(delegated,`/nodes/${policy.node}/revert`,{reason:'undo'}),'a delegated session cannot approve a policy change');
    await drain();

    const raise=submit(agent,policy.node,()=>writeFileSync(join(source,'score.txt'),'12\n'),'raise the score');
    await drain();
    const gain=JSON.parse((db.prepare("SELECT samples FROM verdicts WHERE node=? AND producer='gain'").get(raise.node) as {samples:string}).samples) as number[];
    assert.ok(gain.every(sample=>Math.abs(sample-.4)<1e-9),`gain ${gain} is weight 2 times 0.2`);

    const command=submit(human,policy.node,()=>writeFileSync(join(source,'fervo.toml'),readFileSync(join(source,'fervo.toml'),'utf8').replace('cmd="cat score.txt"','cmd="cat ./score.txt"')),'measure through ./');
    await drain();
    state.write(human,`/nodes/${command.node}/merge`,{reason:'operator override'});
    assert.equal(command.status().state,'merged');
    assert.equal((db.prepare("SELECT data FROM events WHERE type='policy_changed' AND subject=?").get(command.node) as {data:string}).data,JSON.stringify({paths:['fervo.toml'],baseline:true}));
    assert.ok(db.prepare("SELECT 1 FROM jobs WHERE kind='baseline' AND state='queued'").get(),'a changed metric command queues a new baseline');
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
