/**
# Runner Extension API Tests

Runner extensions replace a provider, wrap the model chain, rewrite commands, and need no model flags they
do not use.

## 1. What This Module Does
Runs `executeJob` with fixture extensions loaded by specifier, then runs `fervo runner --once` with no
model flags and an `--extension` against a served repository whose policy needs no model.
## 2. Why This Module Exists
Producers, providers, middleware and command rewrites are how operators add review stages, vendors, cost
caps and sandboxes without forking the runner.
## 3. How It Fits in the Architecture
`executeJob` against a local mirror, as `eval-metric.test.ts` does; the CLI run talks to `fervo serve`.
## 4. Key Concepts
The rewrite replaces `cat score.txt` with a command that fails if `FERVO_TOKEN` reached it, so a sample of 7
proves both that the rewrite ran and that it ran after the secrets were removed.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { executeJob } from '../src/runner/run.js';
import { loadRunnerExtensions } from '../src/runner/extensions.js';

const cli=resolve('dist/src/cli/main.js');
function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function fervo(cwd:string,env:NodeJS.ProcessEnv,...args:string[]):string{const r=spawnSync(process.execPath,[cli,...args],{cwd,env,encoding:'utf8'});assert.equal(r.status,0,`fervo ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();}

test('runner extensions replace a provider, chain middleware, rewrite commands, and model flags are optional',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-runner-ext-'));
  const token=process.env.FERVO_TOKEN;process.env.FERVO_TOKEN='runner-secret';
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[eval]\nbaseline_samples=2\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');const parent=git(source,'rev-parse','HEAD');
    writeFileSync(join(source,'score.txt'),'12\n');git(source,'commit','-qam','raise');const commit=git(source,'rev-parse','HEAD');
    git(source,'update-ref','refs/heads/main',parent);
    const mirror=join(tmp,'repo.git');git(tmp,'clone','--mirror','-q',source,mirror);

    mkdirSync(join(tmp,'ext'));
    const order:string[]=[];(globalThis as {order?:string[]}).order=order;
    writeFileSync(join(tmp,'ext','provider.ts'),"export default (fervo: any): void => { fervo.registerProvider('anthropic', async (request: any) => { (globalThis as any).order.push(`provider ${request.model} ${request.job.id}`); return { decision: { passed: true, evidence: 'fine' }, usage: { input_tokens: 3, output_tokens: 4 } }; }); };\n");
    for(const name of ['inner','outer'])writeFileSync(join(tmp,'ext',`${name}.ts`),`export default (fervo: any): void => { fervo.wrapModel((next: any) => async (request: any) => { (globalThis as any).order.push('${name} before'); const reply = await next(request); (globalThis as any).order.push('${name} after'); return reply; }); };\n`);
    writeFileSync(join(tmp,'ext','exec.ts'),"export default (fervo: any): void => { fervo.exec((c: any) => c.command === 'cat score.txt' ? { ...c, command: 'test -z \"$FERVO_TOKEN\" && echo $SCORE', env: { ...c.env, SCORE: '7' } } : c); };\n");
    writeFileSync(join(tmp,'ext','again.ts'),"export default (fervo: any): void => { fervo.registerProvider('anthropic', async () => { throw new Error('unused'); }); };\n");
    writeFileSync(join(tmp,'ext','kind.ts'),"export default (fervo: any): void => { fervo.registerProducer('lint', async () => []); };\n");
    const extensions=await loadRunnerExtensions({extensions:['./ext/provider.ts','./ext/inner.ts','./ext/outer.ts','./ext/exec.ts'],disable:[]},tmp);
    assert.deepEqual(extensions.loaded,['builtin:producers','builtin:anthropic','builtin:openai','builtin:token-log','./ext/provider.ts','./ext/inner.ts','./ext/outer.ts','./ext/exec.ts']);

    const job={id:'j_1',kind:'baseline' as const,node:null,state:'running' as const,commit:parent,parent_commit:null,intent:null,scope:null,author:null,author_provider:null,baselines:{}};
    const baseline=await executeJob(job,mirror,{},extensions);
    assert.deepEqual(baseline.verdicts.map(v=>[v.producer,v.samples]),[['metric:m',[7,7]]],'the rewritten command ran, without FERVO_TOKEN');

    const review={...job,id:'j_2',kind:'review' as const,node:'n_1',commit,parent_commit:parent,intent:'raise',scope:['score.txt'],author:'agent',author_provider:'openai'};
    const logged:string[]=[];const write=process.stderr.write.bind(process.stderr);
    process.stderr.write=((chunk:string)=>{logged.push(String(chunk));return true;}) as typeof process.stderr.write;
    let reviewed;try{reviewed=await executeJob(review,mirror,{reviewProvider:'anthropic',reviewModel:'m',reviewTemplate:'Review'},extensions);}finally{process.stderr.write=write;}
    assert.deepEqual(reviewed.verdicts.map(v=>[v.producer,v.passed,v.provider]),[['review',true,'anthropic']]);
    assert.deepEqual(order,['outer before','inner before','provider m j_2','inner after','outer after'],'the last loaded middleware runs first');
    assert.deepEqual(logged,['[callModel] provider=anthropic model=m input_tokens=3 output_tokens=4\n'],'the built-in token log is innermost');
    await assert.rejects(executeJob(review,mirror,{},extensions),/runner flag --review-provider is required: a review job was queued/);

    await assert.rejects(loadRunnerExtensions({extensions:['./ext/provider.ts','./ext/again.ts'],disable:[]},tmp),/extension \.\/ext\/again\.ts: provider anthropic is already registered by \.\/ext\/provider\.ts/);
    await assert.rejects(loadRunnerExtensions({extensions:['./ext/kind.ts'],disable:[]},tmp),/extension \.\/ext\/kind\.ts: unknown job kind lint/);
    const bare=await loadRunnerExtensions({extensions:[],disable:['builtin:producers']},tmp);
    await assert.rejects(executeJob(job,mirror,{},bare),/no producer for job kind baseline \(registered: \)/);

    const root=join(tmp,'root');const init=JSON.parse(fervo(tmp,process.env,'init','--source',source,'--root',root,'--actor','operator'));
    const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const port=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));
    const server=spawn(process.execPath,[cli,'serve','--root',root,'--port',String(port)],{stdio:['ignore','ignore','pipe']});
    let log='';
    await new Promise<void>((done,reject)=>{server.stderr.on('data',(data:Buffer)=>{log+=data.toString();if(log.includes('listening'))done();});server.on('exit',code=>reject(new Error(`server exited ${code}: ${log}`)));});
    try{
      const url=`http://127.0.0.1:${port}`;const human=join(tmp,'human');fervo(tmp,process.env,'clone',url,human,'--token',init.token);
      const runner=JSON.parse(fervo(human,{...process.env,FERVO_TOKEN:init.token},'actor','add','runner-1','--kind','runner','--key','add-runner'));
      const ran=spawnSync(process.execPath,[cli,'runner','--remote',url,'--once','--extension','./ext/exec.ts'],{cwd:tmp,env:{...process.env,FERVO_TOKEN:runner.token},encoding:'utf8'});
      assert.equal(ran.status,0,ran.stderr);
      assert.match(ran.stderr,/\[runner\] extensions builtin:producers, builtin:anthropic, builtin:openai, builtin:token-log, \.\/ext\/exec\.ts/);
      const db=new Database(join(root,'.fervo','fervo.db'),{readonly:true});
      assert.deepEqual(db.prepare("SELECT producer,samples FROM verdicts WHERE producer='metric:m'").all(),[{producer:'metric:m',samples:'[7,7]'}],'baseline ran with no model flags, through the rewrite');
      db.close();
    }finally{server.kill();}
  }finally{if(token===undefined)delete process.env.FERVO_TOKEN;else process.env.FERVO_TOKEN=token;rmSync(tmp,{recursive:true,force:true});}
});
