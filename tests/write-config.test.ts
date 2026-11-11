/**
# Config Reads on Write Paths

Which write paths read `fervo.toml` from `main`.

## 1. What This Module Does
Creates a claim under a valid `fervo.toml`, breaks the file on `main`, and checks that release, renew, disable, abandon and veto still succeed while claims refuse.
## 2. Why This Module Exists
`write()` used to parse and validate `fervo.toml` for every POST inside the single-writer transaction, so a bad config on `main` wedged unrelated writes such as releasing a lease.
## 3. How It Fits in the Architecture
This uses the real state writer and Git repository without model network calls.
## 4. Key Concepts
Only `/claims`, `/submit` and the human `merge` override read the config; every other write path works without it.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/store/db.js';
import { State } from '../src/server/state.js';
import { bareGit } from '../src/server/git.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('write paths that do not use the config succeed when fervo.toml on main does not parse',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-write-config-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const state=new State(db,join(root,'repo.git'),root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['other','agent']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const base=bareGit(state.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);
    const human={id:'human',kind:'human'};const agent={id:'agent',kind:'agent'};
    const kept=state.write(agent,'/claims',{parent:'n_0',scope:['score.txt'],intent:'keep'}) as {lease:string};
    const dropped=state.write(agent,'/claims',{parent:'n_0',scope:['docs/'],intent:'drop'}) as {lease:string};
    writeFileSync(join(source,'score.txt'),'12\n');git(source,'add','score.txt');git(source,'commit','-qm','raise score');const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',state.repo,`HEAD:refs/heads/agents/agent/${kept.lease}`);
    const node=(state.write(agent,'/submit',{lease:kept.lease,commit}) as {node:string}).node;
    // break the config on main: every write that reads it must now fail loudly
    writeFileSync(join(source,'fervo.toml'),'[goal\n');git(source,'add','fervo.toml');git(source,'commit','-qm','break config');git(source,'push','-q',state.repo,'HEAD:refs/heads/main');
    assert.throws(()=>state.write(agent,'/claims',{parent:'n_0',scope:['score.txt'],intent:'again'}),/Invalid TOML document/);
    assert.equal((state.write(agent,`/claims/${dropped.lease}/renew`,{}) as {state:string}).state,'active');
    assert.equal((state.write(agent,`/claims/${dropped.lease}/release`,{}) as {state:string}).state,'released');
    assert.equal((state.write(agent,`/nodes/${node}/abandon`,{reason:'giving up'}) as {state:string}).state,'abandoned');
    assert.equal((state.write(human,'/actors/other/disable',{}) as {disabled:boolean}).disabled,true);
    assert.equal((state.write(human,'/grants',{}) as {grant:string}).grant.length,64);
    db.close();
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
