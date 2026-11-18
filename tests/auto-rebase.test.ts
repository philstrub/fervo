/**
# Server-Side Rebase

What happens to a verified node whose parent is no longer `main`.

## 1. What This Module Does
Verifies two nodes claimed on the same parent, one touching each of two files, then a conflicting third.
## 2. Why This Module Exists
Without it, every later node went back to its author for a re-claim and resubmit, which tripled
wall-clock time and tokens in a multi-agent run even though the changes were disjoint.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
A clean `git merge-tree` result becomes a successor node on the current main with a fresh eval job; a
conflicting one still reports `needs_rebase`.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/store/db.js';
import { State } from '../src/server/state.js';
import { builtinServerExtensions } from '../src/server/extensions.js';
import { bareGit } from '../src/server/git.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const improved={verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]};

test('a verified node whose parent main has moved past is rebased by the server when it merges cleanly',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-rebase-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');writeFileSync(join(source,'a.txt'),'a\n');writeFileSync(join(source,'b.txt'),'b\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root,builtinServerExtensions);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const agent={id:'agent',kind:'agent'};const runner={id:'runner',kind:'runner'};
    const submit=(file:string,content:string)=>{
      const claim=state.write(agent,'/claims',{parent:'n_0',scope:[file],intent:`edit ${file}`}) as {lease:string};
      git(source,'checkout','-q',base);writeFileSync(join(source,file),content);git(source,'add',file);git(source,'commit','-qm',`edit ${file}`);const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
      return (state.write(agent,'/submit',{lease:claim.lease,commit}) as {node:string}).node;
    };
    const first=submit('a.txt','a2\n');const second=submit('b.txt','b2\n');const third=submit('a.txt','a3\n');
    const evalFirst=state.lease(runner) as {id:string;node:string};assert.equal(evalFirst.node,first);
    state.result(runner,evalFirst.id,improved);assert.equal((state.status(first) as {state:string}).state,'merged');
    const evalSecond=state.lease(runner) as {id:string;node:string};assert.equal(evalSecond.node,second);
    state.result(runner,evalSecond.id,improved);const status=state.status(second) as {state:string;reason:string;next_action:string};
    assert.equal(status.state,'verified');assert.match(status.reason,/^rebased by the server as n_/);assert.equal(status.next_action,'stop');
    const successor=status.reason.slice('rebased by the server as '.length);
    const row=db.prepare('SELECT * FROM nodes WHERE id=?').get(successor) as Record<string,string>;assert.ok(row);
    assert.equal(row.parent_node,first);assert.equal(row.supersedes,second);assert.equal(row.author,'agent');assert.equal(row.state,'submitted');assert.deepEqual(JSON.parse(row.changed_paths!),['b.txt']);
    assert.ok(db.prepare("SELECT 1 FROM events WHERE type='node_rebased' AND subject=?").get(second));
    assert.equal(db.prepare("SELECT 1 FROM events WHERE type='needs_rebase'").get(),undefined);
    const evalThird=state.lease(runner) as {id:string;node:string};assert.equal(evalThird.node,third);
    state.result(runner,evalThird.id,improved);const conflict=state.status(third) as {reason:string;next_action:string};
    assert.equal(conflict.reason,'needs_rebase');assert.equal(conflict.next_action,'rebase');
    const postmerge=state.lease(runner) as {id:string;kind:string};assert.equal(postmerge.kind,'postmerge');
    const evalSuccessor=state.lease(runner) as {id:string;node:string};assert.equal(evalSuccessor.node,successor);
    state.result(runner,evalSuccessor.id,improved);assert.equal((state.status(successor) as {state:string}).state,'merged');
    const head=bareGit(state.repo,'rev-parse','refs/heads/main');assert.equal(head,row.commit_sha!);
    assert.equal(bareGit(state.repo,'show',`${head}:a.txt`),'a2');assert.equal(bareGit(state.repo,'show',`${head}:b.txt`),'b2');
    assert.equal(bareGit(state.repo,'log','-1','--format=%s',head),'edit b.txt');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
