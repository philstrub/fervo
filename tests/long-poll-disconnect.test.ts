/**
# Long-Poll Disconnect Tests

A long poll whose client has gone stops: it leases nothing and does not outlive the server.

## 1. What This Module Does
Starts a runner's lease poll and a status poll, aborts both clients, then queues a job and closes the
server. The job must stay queued, and no handler may touch the closed database.
## 2. Why This Module Exists
Found running the systemd units: a runner stopped mid-poll left the poll running, `serve` closed the
database under it on SIGTERM, and a job queued meanwhile would have been leased to the runner that was gone,
using up one of its three attempts.
## 3. How It Fits in the Architecture
Serves in process and reads the database through its own connection.
## 4. Key Concepts
`close()` resolves once no connection is open; an aborted client's connection is already closed.
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

test('an aborted long poll leases nothing and stops before the server closes the database',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-disconnect-'));
  const logged:string[]=[];const write=process.stderr.write.bind(process.stderr);
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const db=openDb(root);const at=new Date().toISOString();
    for(const [id,kind] of [['human','human'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,createHash('sha256').update(`${id}-token`).digest('hex'),at);
    const base=bareGit(join(root,'repo.git'),'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'human','baseline','[]','[]','merged',1,base,at);db.close();

    const server=createFervoServer(root,'http://unused',builtinServerExtensions);
    await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    process.stderr.write=((chunk:string)=>{logged.push(String(chunk));return true;}) as typeof process.stderr.write;
    const lease=new AbortController();const status=new AbortController();
    const polls=[
      fetch(`${url}/jobs/lease`,{method:'POST',signal:lease.signal,headers:{Authorization:'Bearer runner-token','Idempotency-Key':'lease-1','Content-Type':'application/json'},body:JSON.stringify({wait:30})}).catch(()=>null),
      fetch(`${url}/status/n_0?wait=30`,{signal:status.signal,headers:{Authorization:'Bearer human-token'}}).catch(()=>null),
    ];
    await sleep(300);lease.abort();status.abort();await Promise.all(polls);await sleep(100);
    const queued=await fetch(`${url}/baseline`,{method:'POST',headers:{Authorization:'Bearer human-token','Idempotency-Key':'baseline-1','Content-Type':'application/json'},body:'{}'});
    assert.equal(queued.status,200);
    await new Promise(done=>server.close(done));await sleep(500);
    process.stderr.write=write;

    const check=new Database(join(root,'.fervo','fervo.db'),{readonly:true});
    assert.deepEqual(check.prepare("SELECT kind,state,attempts FROM jobs").all(),[{kind:'baseline',state:'queued',attempts:0}],'the job waits for a runner that is there');
    assert.equal((check.prepare("SELECT COUNT(*) AS n FROM idempotency WHERE key='lease-1'").get() as {n:number}).n,0,'the aborted lease recorded no response');
    check.close();
    assert.deepEqual(logged.filter(line=>line.startsWith('[handler]')),[],'no handler ran against the closed database');
  }finally{process.stderr.write=write;rmSync(tmp,{recursive:true,force:true});}
});
