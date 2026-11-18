/**
# Long-Poll Wake Tests

A long poll answers as soon as a commit changes what it waits for, and within 5 s of a change no write
announces.

## 1. What This Module Does
Holds a runner's lease poll and a claim's status poll, makes the change each waits for over HTTP, and
times the answers. Then lets a running job's lease lapse behind the server's back and times the lease poll.
## 2. Why This Module Exists
Each waiting request re-read the database every 200 ms: 200 waiting agents cost about 40% of a core.
Waiters now sleep until a commit wakes them.
## 3. How It Fits in the Architecture
Serves in process; the lapse is written through a separate SQLite connection, which records no event.
## 4. Key Concepts
A woken poll answers in milliseconds; 1 s bounds it loosely. The fallback is 5 s, so the lapse is
noticed within about 5 s of being written, not 200 ms.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDb } from '../src/store/db.js';
import { createFervoServer } from '../src/server/http.js';
import { bareGit } from '../src/server/git.js';
import { builtinServerExtensions } from '../src/server/extensions.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const sleep=(ms:number)=>new Promise(done=>setTimeout(done,ms));

test('a commit wakes long polls at once, and a lapsed lease wakes the lease poll within 5 s',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-wake-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,createHash('sha256').update(`${id}-token`).digest('hex'),at);
    const base=bareGit(join(root,'repo.git'),'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);db.close();

    const server=createFervoServer(root,'http://unused',builtinServerExtensions);
    await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    try{
      let n=0;
      const post=(actor:string,path:string,body:unknown)=>fetch(`${url}${path}`,{method:'POST',headers:{Authorization:`Bearer ${actor}-token`,'Idempotency-Key':`k${n++}`,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()) as Promise<Record<string,any>>;
      const timed=async<T>(call:Promise<T>,after:number)=>{const value=await call;return {value,ms:Date.now()-after};};

      const lease=post('runner','/jobs/lease',{wait:30});await sleep(300);
      const queuedAt=Date.now();const queued=await post('human','/baseline',{});
      const leased=await timed(lease,queuedAt);
      assert.equal(leased.value.id,queued.id,'the poll leased the job queued while it waited');
      assert.ok(leased.ms<1000,`answered ${leased.ms} ms after the commit`);

      const claim=await post('agent','/claims',{parent:'n_0',scope:['score.txt'],intent:'raise'});
      const status=fetch(`${url}/status/${claim.lease}?wait=30`,{headers:{Authorization:'Bearer agent-token'}}).then(r=>r.json()) as Promise<{state:string}>;await sleep(300);
      const releasedAt=Date.now();await post('agent',`/claims/${claim.lease}/release`,{});
      const released=await timed(status,releasedAt);
      assert.equal(released.value.state,'released');
      assert.ok(released.ms<1000,`answered ${released.ms} ms after the commit`);

      const again=post('runner','/jobs/lease',{wait:30});await sleep(300);
      const behind=new Database(join(root,'.fervo','fervo.db'));const lapsedAt=Date.now();
      behind.prepare('UPDATE jobs SET lease_until=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),queued.id);behind.close();
      const relet=await timed(again,lapsedAt);
      assert.equal(relet.value.id,queued.id,'a lapsed lease is offered again');
      assert.ok(relet.ms<6000,`noticed ${relet.ms} ms after the lapse`);
    }finally{await new Promise(done=>server.close(done));}
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
