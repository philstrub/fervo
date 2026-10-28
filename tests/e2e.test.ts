/**
# End-to-End Managed Repository Tests

The concrete CLI, Git, server, and runner loop required by the first MVP.

## 1. What This Module Does
Exercises a temporary bare repository over real authenticated HTTP.
## 2. Why This Module Exists
Unit tests cannot expose mismatches among hooks, refs, leases, and policy transitions.
## 3. How It Fits in the Architecture
A scripted contributor and fake model run without network keys.
## 4. Key Concepts
The metric is read from a committed file; main advances only after evaluation and review.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runRunner } from '../src/runner/run.js';

const cli=resolve('dist/src/cli/main.js');
function command(cwd:string,bin:string,...args:string[]):string {const r=spawnSync(bin,args,{cwd,encoding:'utf8'});assert.equal(r.status,0,`${bin} ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}
function fervo(cwd:string,...args:string[]):any{return JSON.parse(command(cwd,process.execPath,cli,...args));}

test('scripted agent reaches main through baseline, eval, review and postmerge',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-e2e-'));
  try {
    const source=join(tmp,'source');mkdirSync(source);
    command(source,'git','init','-q','-b','main');command(source,'git','config','user.email','test@example.com');command(source,'git','config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),`[goal]\ntext = "Raise the score"\n[tests]\ncmd = "test -f score.txt"\n[[metrics]]\nname = "score"\ncmd = "cat score.txt"\ndirection = "max"\nweight = 0.8\n[judge]\ntemplate = "pairwise"\nweight = 0.2\n[eval]\nsamples = 3\nbaseline_samples = 5\n[pinned]\npaths = ["fervo.toml"]\n[merge.main]\nrequire = ["tests", "frontier_gain", "review"]\n`);
    writeFileSync(join(source,'score.txt'),'10\n');command(source,'git','add','.');command(source,'git','commit','-qm','baseline');
    const root=join(tmp,'manager');const init=fervo(tmp,'init','--source',source,'--root',root,'--actor','operator');
    const probe=createNetServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address!=='string');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    await new Promise<void>((resolve,reject)=>{server.stderr.on('data',(data:Buffer)=>{if(data.toString().includes('listening'))resolve();});server.on('error',reject);server.on('exit',code=>reject(new Error(`server exited ${code}`)));});
    try {
      const url=`http://127.0.0.1:${port}`;
      const human=join(tmp,'human');fervo(tmp,'clone',url,human,'--token',init.token);
      const runner=fervo(human,'actor','add','runner','--kind','runner','--key','add-runner');
      const agent=fervo(human,'actor','add','agent-1','--kind','agent','--provider','openai','--model','test','--harness','script','--key','add-agent');
      const settings={anthropicModel:'fake',openaiModel:'fake',reviewProvider:'anthropic',reviewModel:'fake',judgeTemplate:'Compare the change',reviewTemplate:'Review the change'};
      const model=async(_provider:string,_model:string,prompt:string)=>prompt.includes('Return only JSON {"passed"')?{passed:true,evidence:'review passed'}:{preference:0.5,evidence:'neutral'};
      await runRunner(url,runner.token,settings,model,true);
      const clone=join(tmp,'agent');fervo(tmp,'clone',url,clone,'--token',agent.token);
      command(clone,'git','config','user.email','agent@example.com');command(clone,'git','config','user.name','Agent');
      const context=fervo(clone,'context');assert.equal(context.main.node,'n_0');
      const claim=fervo(clone,'claim','--parent','n_0','--scope','score.txt','--intent','improve score','--key','claim-1','--checkout');
      writeFileSync(join(clone,'score.txt'),'12\n');command(clone,'git','add','score.txt');command(clone,'git','commit','-qm','improve score');
      const mainPush=spawnSync('git',['push','origin','HEAD:refs/heads/main'],{cwd:clone,encoding:'utf8'});assert.notEqual(mainPush.status,0);
      const foreignPush=spawnSync('git',['push','origin','HEAD:refs/heads/agents/other/lease'],{cwd:clone,encoding:'utf8'});assert.notEqual(foreignPush.status,0);
      const submitted=fervo(clone,'submit','--lease',claim.lease,'--key','submit-1');
      assert.equal(fervo(clone,'status',submitted.node).state,'submitted');
      await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone,'status',submitted.node).state,'verified');
      await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone,'status',submitted.node).state,'merged');
      await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone,'context').main.node,submitted.node);

      const replay=await fetch(`${url}/claims`,{method:'POST',headers:{Authorization:`Bearer ${agent.token}`,'Idempotency-Key':'claim-1','Content-Type':'application/json'},body:JSON.stringify({parent:submitted.node,scope:['score.txt'],intent:'different'})});
      assert.equal(replay.status,400);assert.match(await replay.text(),/different request/);

      const same=fervo(clone,'claim','--parent',submitted.node,'--scope','notes.txt','--intent','document without changing metric','--key','same-claim','--checkout');
      writeFileSync(join(clone,'notes.txt'),'notes\n');command(clone,'git','add','notes.txt');command(clone,'git','commit','-qm','add notes');
      const sameNode=fervo(clone,'submit','--lease',same.lease,'--key','same-submit').node;
      await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone,'status',sameNode).outcome,'within_noise');

      const pinned=fervo(clone,'claim','--parent',submitted.node,'--scope','fervo.toml','--intent','change policy','--key','pinned-claim','--checkout');
      writeFileSync(join(clone,'fervo.toml'),readFileSync(join(clone,'fervo.toml'),'utf8')+'\n# unauthorized\n');command(clone,'git','add','fervo.toml');command(clone,'git','commit','-qm','change policy');
      const pinnedNode=fervo(clone,'submit','--lease',pinned.lease,'--key','pinned-submit').node;
      assert.equal(fervo(clone,'status',pinnedNode).state,'rejected');

      const secondActor=fervo(human,'actor','add','agent-2','--kind','agent','--provider','openai','--model','test','--harness','script','--key','add-agent-2');
      const clone2=join(tmp,'agent2');fervo(tmp,'clone',url,clone2,'--token',secondActor.token);
      command(clone2,'git','config','user.email','agent2@example.com');command(clone2,'git','config','user.name','Agent Two');
      const firstClaim=fervo(clone,'claim','--parent',submitted.node,'--scope','score.txt','--intent','raise to 14','--key','parallel-1','--checkout');
      const secondClaim=fervo(clone2,'claim','--parent',submitted.node,'--scope','score.txt','--intent','raise to 13','--key','parallel-2','--checkout');
      assert.equal(secondClaim.overlaps.length,1);
      writeFileSync(join(clone,'score.txt'),'14\n');command(clone,'git','add','score.txt');command(clone,'git','commit','-qm','raise to 14');
      writeFileSync(join(clone2,'score.txt'),'13\n');command(clone2,'git','add','score.txt');command(clone2,'git','commit','-qm','raise to 13');
      const firstNode=fervo(clone,'submit','--lease',firstClaim.lease,'--key','parallel-submit-1').node;
      const secondNode=fervo(clone2,'submit','--lease',secondClaim.lease,'--key','parallel-submit-2').node;
      for(let i=0;i<4;i++)await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone,'status',firstNode).state,'merged');
      assert.equal(fervo(clone2,'status',secondNode).next_action,'rebase');
      const rebased=fervo(clone2,'claim','--parent',firstNode,'--supersedes',secondNode,'--scope','score.txt','--intent','raise to 15 after rebase','--key','rebased-claim','--checkout');
      writeFileSync(join(clone2,'score.txt'),'15\n');command(clone2,'git','add','score.txt');command(clone2,'git','commit','-qm','raise to 15');
      const rebasedNode=fervo(clone2,'submit','--lease',rebased.lease,'--key','rebased-submit').node;
      for(let i=0;i<3;i++)await runRunner(url,runner.token,settings,model,true);
      assert.equal(fervo(clone2,'status',rebasedNode).state,'merged');
    } finally {server.kill();await new Promise<void>(resolve=>server.on('exit',()=>resolve()));}
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
