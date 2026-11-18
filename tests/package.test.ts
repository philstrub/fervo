/**
# Package Tests

The tarball `npm publish` would upload installs from the registry and works: the CLI end to end, the
library imports, and the extension types.

## 1. What This Module Does
Packs the package, installs it globally into a temporary prefix, and with that `fervo` alone: inits a
repository, serves it, enrolls a Claude Code session in a human clone, and takes one agent node from
claim to merge. Then installs the same tarball into a project and imports and type-checks against it.
## 2. Why This Module Exists
Every other test runs the repository's `dist/`. Only an install shows that `files` ships what the code
reads at runtime (`settings.default.json`, `skill/SKILL.md`, `package.json`), and that the dependencies
resolve and the native SQLite binding loads on each supported platform.
## 3. How It Fits in the Architecture
Installs dependencies from the npm registry, so it runs only with `FERVO_TEST_PACKAGE=1`: the CI
`package` job sets it on each OS and Node version that `engines` admits.
## 4. Key Concepts
`npm pack --ignore-scripts` packs the already built `dist/`; publishing runs `prepack`, which builds.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function sh(cwd:string,command:string,args:string[],env:NodeJS.ProcessEnv=process.env,input=''):string{const r=spawnSync(command,args,{cwd,env,input,encoding:'utf8'});assert.equal(r.status,0,`${command} ${args.join(' ')}: ${r.stdout}${r.stderr}`);return r.stdout.trim();}
async function port():Promise<number>{const probe=createNetServer();await new Promise<void>(done=>probe.listen(0,'127.0.0.1',done));const p=(probe.address() as {port:number}).port;await new Promise<void>(done=>probe.close(()=>done()));return p;}

test('the packed tarball installs, runs a node from claim to merge, and imports and types as a library',{skip:process.env.FERVO_TEST_PACKAGE!=='1'&&'set FERVO_TEST_PACKAGE=1: installs from the npm registry'},async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-package-'));let server:ChildProcess|undefined;
  try{
    const npm={...process.env,npm_config_update_notifier:'false',npm_config_fund:'false',npm_config_audit:'false'};
    const tarball=join(tmp,sh(resolve('.'),'npm',['pack','--ignore-scripts','--pack-destination',tmp],npm).split('\n').pop()!);
    sh(tmp,'npm',['install','-g','--prefix',join(tmp,'global'),tarball],npm);
    const bin=join(tmp,'global','bin','fervo');
    const fervo=(cwd:string,env:NodeJS.ProcessEnv,...args:string[])=>sh(cwd,bin,args,env);
    const { version }=JSON.parse(readFileSync('package.json','utf8')) as {version:string};
    assert.equal(fervo(tmp,process.env,'--version'),version);

    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');
    const root=join(tmp,'root');const init=JSON.parse(fervo(tmp,process.env,'init','--source',source,'--root',root,'--actor','operator')) as {token:string};
    assert.equal(readFileSync(join(root,'.fervo','settings.json'),'utf8'),readFileSync('settings.default.json','utf8'),'init writes the packaged default settings');

    const p=await port();const url=`http://127.0.0.1:${p}`;
    server=spawn(bin,['serve','--root',root,'--port',String(p)],{stdio:['ignore','ignore','pipe']});let log='';
    await new Promise<void>((done,reject)=>{server!.stderr!.on('data',(data:Buffer)=>{log+=data.toString();if(log.includes('listening'))done();});server!.on('exit',code=>reject(new Error(`server exited ${code}: ${log}`)));});
    const as=(token:string)=>({...process.env,FERVO_TOKEN:token});

    const human=join(tmp,'human');fervo(tmp,process.env,'clone',url,human,'--token',init.token);
    const envFile=join(tmp,'claude-env');writeFileSync(envFile,'');const {FERVO_TOKEN:_,...bare}=process.env;
    const hook=JSON.parse(sh(human,bin,['enroll'],{...bare,CLAUDE_ENV_FILE:envFile},JSON.stringify({session_id:'session-0001',cwd:human,model:'claude-test',source:'startup',hook_event_name:'SessionStart'}))) as {hookSpecificOutput:{additionalContext:string}};
    assert.ok(hook.hookSpecificOutput.additionalContext.includes(readFileSync('skill/SKILL.md','utf8')),'the session gets the packaged skill');
    assert.match(readFileSync(envFile,'utf8'),/^export FERVO_TOKEN=/m);

    const agentToken=(JSON.parse(fervo(human,as(init.token),'actor','add','agent-1','--kind','agent','--provider','openai','--key','add-agent')) as {token:string}).token;
    const runnerToken=(JSON.parse(fervo(human,as(init.token),'actor','add','runner-1','--kind','runner','--key','add-runner')) as {token:string}).token;
    fervo(tmp,as(runnerToken),'runner','--remote',url,'--once');
    const agent=join(tmp,'agent');fervo(tmp,process.env,'clone',url,agent,'--token',agentToken);git(agent,'config','user.email','agent@example.com');git(agent,'config','user.name','Agent');
    const claim=JSON.parse(fervo(agent,process.env,'claim','--parent','n_0','--scope','score.txt','--intent','raise','--checkout','--key','c1')) as {lease:string;worktree:string};
    writeFileSync(join(claim.worktree,'score.txt'),'12\n');git(claim.worktree,'commit','-qam','raise');
    const node=(JSON.parse(fervo(claim.worktree,process.env,'submit','--lease',claim.lease,'--key','s1')) as {node:string}).node;
    fervo(tmp,as(runnerToken),'runner','--remote',url,'--once');
    assert.equal((JSON.parse(fervo(agent,process.env,'status',node)) as {state:string}).state,'merged');

    const app=join(tmp,'app');mkdirSync(app);writeFileSync(join(app,'package.json'),'{"type":"module","private":true}\n');
    sh(app,'npm',['install',tarball],npm);
    writeFileSync(join(app,'main.js'),`import { ClaimIn, createFervoServer } from 'fervo';\nconsole.log(typeof createFervoServer, ClaimIn.parse({ parent: 'n_0', scope: ['a'], intent: 'x' }).intent);\n`);
    assert.equal(sh(app,process.execPath,['main.js']),'function x');
    writeFileSync(join(app,'limits.ts'),`import type { ServerAPI } from 'fervo/extension';\nexport default (fervo: ServerAPI): void => { fervo.gate('claim', (actor, input) => { if (actor.kind === 'agent' && input.scope.length > 3) throw new Error('narrow it'); }); };\n`);
    sh(app,process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--noEmit','--strict','--module','nodenext','--moduleResolution','nodenext','--target','es2024','--types','node','--typeRoots',resolve('node_modules/@types'),'limits.ts']);
  }finally{
    if(server){server.kill('SIGTERM');await new Promise(done=>server!.on('close',done));}
    rmSync(tmp,{recursive:true,force:true});
  }
});
