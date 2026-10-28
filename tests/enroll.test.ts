/**
# Session Enrollment Tests

Harness sessions in a human clone become their own actors without the human token.

## 1. What This Module Does
Runs a real server, makes a human clone, and calls `fervo enroll` the way Claude Code's SessionStart hook does.
## 2. Why This Module Exists
The security claims of enrollment (no human token on disk, no human powers for agents, grants only
from humans, no usable secret in the database) are only true if every boundary enforces them.
## 3. How It Fits in the Architecture
The hook input and `CLAUDE_ENV_FILE` are simulated; everything else is the shipped CLI and server.
## 4. Key Concepts
One actor per session id; re-enrolling a session rotates its token; a grant makes a session human.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDb } from '../src/store/db.js';

const cli=resolve('dist/src/cli/main.js');
function run(cwd:string,env:NodeJS.ProcessEnv,input:string,...args:string[]){return spawnSync(process.execPath,[cli,...args],{cwd,env,input,encoding:'utf8'});}
function ok(r:ReturnType<typeof run>):any{assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
const bare=():NodeJS.ProcessEnv=>{const {FERVO_TOKEN:_t,FERVO_GRANT:_g,...env}=process.env;return env;};
function files(dir:string):string[]{return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):[path];});}

test('each session enrolls as its own actor and only a grant gives human powers',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-enroll-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);
    spawnSync('git',['init','-q','-b','main'],{cwd:source});
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');
    spawnSync('git',['add','.'],{cwd:source});spawnSync('git',['-c','user.name=t','-c','user.email=t@x','commit','-qm','baseline'],{cwd:source});
    const root=join(tmp,'managed');const init=ok(run(tmp,bare(),'','init','--source',source,'--root',root,'--actor','operator'));
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    await new Promise<void>((done,fail)=>{server.stderr.on('data',(d:Buffer)=>{if(d.toString().includes('listening'))done();});server.on('exit',code=>fail(new Error(`server exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const api=async(token:string,method:string,path:string,body?:unknown)=>fetch(`${url}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Idempotency-Key':`k-${Math.random()}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      const clone=join(tmp,'clone');
      const cloned=ok(run(tmp,{...bare(),FERVO_TOKEN:init.token},'','clone',url,clone));
      assert.equal(cloned.actor.kind,'enroller');assert.equal(cloned.actor.owner,'operator');assert.equal(cloned.actor.provider,'anthropic');
      assert.ok(files(clone).every(path=>!readFileSync(path,'latin1').includes(init.token)),'the human token is stored in the clone');
      assert.match(readFileSync(join(clone,'.claude','settings.local.json'),'utf8'),/enroll/);
      assert.equal(spawnSync('git',['status','--porcelain'],{cwd:clone,encoding:'utf8'}).stdout,'');
      for(const [key,value] of [['user.name','a'],['user.email','a@x']])spawnSync('git',['config',key!,value!],{cwd:clone});

      const enroll=(session:string,env:NodeJS.ProcessEnv={})=>{const file=join(tmp,`env-${Math.random()}`);writeFileSync(file,'');const r=run(clone,{...bare(),CLAUDE_ENV_FILE:file,...env},JSON.stringify({session_id:session,cwd:clone,model:'claude-test',source:'startup',hook_event_name:'SessionStart'}),'enroll');return {r,env:readFileSync(file,'utf8')};};
      const tokenOf=(env:string)=>/export FERVO_TOKEN=([0-9a-f]+)/.exec(env)![1]!;
      const sessionA='aaaaaaaa-1111-2222-3333-444444444444', sessionB='bbbbbbbb-1111-2222-3333-444444444444', sessionC='cccccccc-1111-2222-3333-444444444444';
      const first=enroll(sessionA);const hook=ok(first.r);const tokenA=tokenOf(first.env);
      assert.match(hook.hookSpecificOutput.additionalContext,/operator-aaaaaaaa1111 \(kind agent\)/);
      const asA={...bare(),FERVO_TOKEN:tokenA};
      const whoA=await (await api(tokenA,'GET','/whoami')).json() as {actor:{id:string;kind:string;provider:string;harness:string;model:string;session:string};branch_prefix:string};
      assert.deepEqual([whoA.actor.kind,whoA.actor.provider,whoA.actor.harness,whoA.actor.model,whoA.actor.session,whoA.branch_prefix],['agent','anthropic','claude-code','claude-test',sessionA,'agents/operator-aaaaaaaa1111']);

      assert.match(run(clone,asA,'','actor','list').stderr,/human token required/);
      assert.match(run(clone,asA,'','merge','n_0','--reason','x','--key','m').stderr,/human token required/);
      assert.match(run(clone,bare(),'','merge','n_0','--reason','x','--key','m').stderr,/human token required/);
      assert.match(await (await api(tokenA,'POST','/grants')).text(),/human token required/);
      assert.match(await (await api(tokenA,'POST','/enroll',{session:sessionC,model:null})).text(),/enroller token required/);

      const tokenB=tokenOf(enroll(sessionB).env);const asB={...bare(),FERVO_TOKEN:tokenB};
      const claimA=ok(run(clone,asA,'','claim','--parent','n_0','--scope','score.txt','--intent','a','--key','claim-1','--checkout'));
      const claimB=ok(run(clone,asB,'','claim','--parent','n_0','--scope','score.txt','--intent','b','--key','claim-1'));
      assert.notEqual(claimA.lease,claimB.lease);assert.equal(claimA.branch,`agents/operator-aaaaaaaa1111/${claimA.lease}`);
      writeFileSync(join(clone,'score.txt'),'12\n');spawnSync('git',['commit','-qam','raise'],{cwd:clone});
      assert.notEqual(spawnSync('git',['push','origin',`HEAD:refs/heads/${claimA.branch}-plain`],{cwd:clone}).status,0,'the enroller token in .git/config can push');
      const submitted=ok(run(clone,asA,'','submit','--lease',claimA.lease,'--key','submit-1'));
      assert.equal(ok(run(clone,asA,'','status',submitted.node)).state,'submitted');

      const resumed=tokenOf(enroll(sessionA).env);
      assert.equal((await api(tokenA,'GET','/whoami')).status,401);
      assert.equal(((await (await api(resumed,'GET','/whoami')).json()) as {actor:{id:string}}).actor.id,'operator-aaaaaaaa1111');

      const leaked=enroll(sessionC,{FERVO_TOKEN:init.token});assert.equal(leaked.r.status,2);assert.match(leaked.r.stderr,/environment Claude Code inherited/);assert.equal(leaked.env,"unset FERVO_TOKEN\n");
      assert.match(enroll(sessionC,{FERVO_GRANT:'0'.repeat(64)}).r.stderr,/grant is invalid/);
      const grant=await (await api(init.token,'POST','/grants')).json() as {grant:string};
      const delegated=enroll(sessionC,{FERVO_GRANT:grant.grant});
      assert.match(delegated.env,/unset FERVO_GRANT/);
      const asC={...bare(),FERVO_TOKEN:tokenOf(delegated.env)};
      assert.ok(ok(run(clone,asC,'','actor','list')).some((a:{id:string;kind:string;owner:string})=>a.id==='operator-cccccccc1111'&&a.kind==='human'&&a.owner==='operator'));
      assert.equal(ok(run(clone,asC,'','actor','disable','operator-bbbbbbbb1111','--key','disable-b')).disabled,true);
      assert.equal((await api(tokenB,'GET','/whoami')).status,401);
      assert.match(enroll(sessionB).r.stderr,/session actor is disabled/);
      assert.match(enroll(sessionC).r.stderr,/resume it through fervo delegate/);
      assert.match(enroll(sessionA,{FERVO_GRANT:grant.grant}).r.stderr,/agent session cannot gain human powers/);

      const db=openDb(root);
      const stored=(db.prepare('SELECT response FROM idempotency').all() as {response:string}[]).map(row=>row.response).join('\n');
      db.close();
      for(const secret of [resumed,grant.grant,tokenOf(delegated.env),readFileSync(join(clone,'.git','config'),'utf8').match(/Bearer ([0-9a-f]+)/)![1]!])assert.ok(!stored.includes(secret),'a secret is stored in the idempotency table');
    } finally {server.kill();await new Promise<void>(done=>server.on('exit',()=>done()));}
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
