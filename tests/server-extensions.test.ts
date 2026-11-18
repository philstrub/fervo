/**
# Server Extension API Tests

Rules named in `fervo.toml`, gates that refuse writes, and listeners that see only committed events.

## 1. What This Module Does
Serves a managed repository in process with a custom rule, a claim gate, a submit gate and two listeners,
then claims, submits and merges through HTTP.
## 2. Why This Module Exists
Gates and listeners sit on the write path: a gate must refuse before anything is written, and a listener
must never see, or break, a write.
## 3. How It Fits in the Architecture
Builds `ServerExtensions` by hand for the HTTP flow, and loads one fixture through the settings file to
check that `gate` and `on` register through the loader too.
## 4. Key Concepts
The `node_merged` listener reads through its own SQLite connection, which sees only committed data: had
it been called inside the merge transaction, it would see the node still `verified`.
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
import { builtinServerExtensions, loadServerExtensions, type ServerExtensions } from '../src/server/extensions.js';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('a rule named in fervo.toml decides merging, gates refuse before writing, listeners run after commit',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-server-ext-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests","no_regression"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));const repo=join(root,'repo.git');

    await assert.rejects(loadServerExtensions(root),/fervo\.toml on main requires rules nothing registers: no_regression \(registered: tests, frontier_gain, review, scope, human\)/);
    mkdirSync(join(root,'.fervo','ext'));
    writeFileSync(join(root,'.fervo','ext','all.ts'),"export default (fervo: any): void => { fervo.registerRule({ name: 'no_regression', evaluate: () => ({ state: 'satisfied' }) }); fervo.gate('claim', () => {}); fervo.on('*', () => {}); };\n");
    writeFileSync(join(root,'.fervo','ext','lease.ts'),"export default (fervo: any): void => { fervo.gate('lease', () => {}); };\n");
    writeFileSync(join(root,'.fervo','settings.json'),JSON.stringify({extensions:['./ext/all.ts']}));
    const loaded=await loadServerExtensions(root);
    assert.deepEqual([Object.keys(loaded.rules).includes('no_regression'),loaded.gates.claim.map(g=>g.source),loaded.listeners.map(l=>[l.source,l.type])],[true,['./ext/all.ts'],[['./ext/all.ts','*']]]);
    writeFileSync(join(root,'.fervo','settings.json'),JSON.stringify({extensions:['./ext/all.ts','./ext/lease.ts']}));
    await assert.rejects(loadServerExtensions(root),/extension \.\/ext\/lease\.ts: unknown gate lease: gates are claim, submit/);

    const db=openDb(root);const at=new Date().toISOString();
    for(const id of ['agent','agent-2','runner'])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,id==='runner'?'runner':'agent',createHash('sha256').update(`${id}-token`).digest('hex'),at);
    const base=bareGit(repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'agent','baseline','[]','[]','merged',1,base,at);db.close();

    const seen:{seq:number;type:string}[]=[];const atMerge:string[]=[];
    const committed=new Database(join(root,'.fervo','fervo.db'),{readonly:true});
    const extensions:ServerExtensions={...builtinServerExtensions,
      rules:{...builtinServerExtensions.rules,no_regression:{name:'no_regression',evaluate:node=>node.outcome==='regressed'?{state:'failed',reason:'regressed'}:{state:'satisfied'}}},
      gates:{
        claim:[{source:'one-claim',check:(actor,_input,read)=>{if(read.get("SELECT 1 FROM claims WHERE holder=? AND state='active'",actor.id))throw new Error('one open claim per actor');}}],
        submit:[{source:'writer',check:(actor,_input,read)=>{if(actor.id==='agent-2')read.get("UPDATE claims SET state='released'");}}],
      },
      listeners:[
        {source:'recorder',type:'*',listener:event=>{seen.push({seq:event.seq,type:event.type});}},
        {source:'merge-watch',type:'node_merged',listener:event=>{atMerge.push((committed.prepare('SELECT state FROM nodes WHERE id=?').get(event.subject) as {state:string}).state);throw new Error('webhook down');}},
      ]};
    const server=createFervoServer(root,'http://unused',extensions);
    await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
    const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
    const logged:string[]=[];const write=process.stderr.write.bind(process.stderr);
    process.stderr.write=((chunk:string)=>{logged.push(String(chunk));return true;}) as typeof process.stderr.write;
    try{
      let n=0;
      const post=async(actor:string,path:string,body:unknown)=>{const r=await fetch(`${url}${path}`,{method:'POST',headers:{Authorization:`Bearer ${actor}-token`,'Idempotency-Key':`k${n++}`,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json() as Record<string,any>};};
      const claim=await post('agent','/claims',{parent:'n_0',scope:['score.txt'],intent:'raise'});assert.equal(claim.status,200);
      assert.deepEqual(await post('agent','/claims',{parent:'n_0',scope:['score.txt'],intent:'again'}),{status:403,body:{error:'claim refused by one-claim: one open claim per actor'}});
      const other=await post('agent-2','/claims',{parent:'n_0',scope:['score.txt'],intent:'other'});assert.equal(other.status,200,'the gate is per actor');

      const commit=(score:string,branch:string)=>{git(source,'reset','-q','--hard',base);writeFileSync(join(source,'score.txt'),`${score}\n`);git(source,'commit','-qam',score);const sha=git(source,'rev-parse','HEAD');git(source,'push','-q','-f',repo,`HEAD:refs/heads/${branch}`);return sha;};
      const refused=await post('agent-2','/submit',{lease:other.body.lease,commit:commit('11',other.body.branch)});
      assert.deepEqual(refused,{status:403,body:{error:"submit refused by writer: the read handle runs only reads: UPDATE claims SET state='released'"}});
      const check=new Database(join(root,'.fervo','fervo.db'),{readonly:true});
      assert.deepEqual([(check.prepare('SELECT COUNT(*) AS n FROM claims').get() as {n:number}).n,(check.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id!='n_0'").get() as {n:number}).n,(check.prepare("SELECT COUNT(*) AS n FROM claims WHERE state='active'").get() as {n:number}).n],[2,0,2],'refusals wrote nothing');
      check.close();

      const sha=commit('12',claim.body.branch);
      const submitted=await post('agent','/submit',{lease:claim.body.lease,commit:sha});assert.equal(submitted.status,200);
      const job=await post('runner','/jobs/lease',{wait:0});assert.equal(job.body.node,submitted.body.node);
      const result=await post('runner',`/jobs/${job.body.id}/result`,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
      assert.equal(result.status,200,'a throwing listener does not fail the write');
      assert.equal(bareGit(repo,'rev-parse','refs/heads/main'),sha,'no_regression satisfied, so the node merged without frontier_gain');
      await new Promise(done=>setImmediate(done));
      assert.deepEqual(atMerge,['merged'],'the listener ran after the merge committed');
      assert.ok(logged.some(line=>/^\[notify\] merge-watch on node_merged #\d+: Error: webhook down/.test(line)),logged.join(''));
      const all=(committed.prepare('SELECT seq,type FROM events ORDER BY seq').all() as {seq:number;type:string}[]);
      assert.deepEqual(seen,all,'every committed event, once, in order');
      assert.ok(seen.some(e=>e.type==='node_merged'));
    }finally{process.stderr.write=write;committed.close();await new Promise(done=>server.close(done));}
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
