/**
# Extension Loader Tests

Operator extensions register rules that policy evaluates, and every way an extension can fail stops startup.

## 1. What This Module Does
Loads a `.ts` path extension and an installed package from `<root>/.fervo/`, replaces the built-in `human`
rule and sees a node merge without a human verdict, disables `builtin:rules`, and checks each failure.
## 2. Why This Module Exists
A rule that silently failed to load would relax merge requirements, so the loader must be strict.
## 3. How It Fits in the Architecture
Calls the loader and `State` directly; `init` and `serve` run through the built CLI.
## 4. Key Concepts
The package fixture exports only the `import` condition, which `require.resolve` cannot resolve: it
proves resolution from `<root>/.fervo/` uses the ESM resolver.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDb } from '../src/store/db.js';
import { State } from '../src/server/state.js';
import { bareGit } from '../src/server/git.js';
import { builtinServerExtensions, loadServerExtensions } from '../src/server/extensions.js';
import { defaultSettings } from '../src/loader.js';

const cli=resolve('dist/src/cli/main.js');
function git(cwd:string,...args:string[]):string{const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('extensions from settings register rules that policy uses; failures stop startup',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'fervo-extensions-'));
  try{
    const source=join(tmp,'source');mkdirSync(source);git(source,'init','-q','-b','main');git(source,'config','user.email','test@example.com');git(source,'config','user.name','Test');
    writeFileSync(join(source,'fervo.toml'),'[goal]\ntext="goal"\n[tests]\ncmd="true"\n[[metrics]]\nname="m"\ncmd="cat score.txt"\ndirection="max"\nweight=1\n[pinned]\npaths=["fervo.toml"]\n[merge.main]\nrequire=["tests","human"]\n');
    writeFileSync(join(source,'score.txt'),'10\n');git(source,'add','.');git(source,'commit','-qm','baseline');

    const initialized=spawnSync(process.execPath,[cli,'init','--source',source,'--root',join(tmp,'initialized'),'--actor','operator'],{encoding:'utf8'});
    assert.equal(initialized.status,0,initialized.stderr);
    const settingsFile=JSON.parse(initialized.stdout).settings as string;
    assert.equal(settingsFile,join(tmp,'initialized','.fervo','settings.json'));
    assert.equal(readFileSync(settingsFile,'utf8'),readFileSync(defaultSettings,'utf8'),'init writes the packaged default');

    const root=join(tmp,'root');mkdirSync(root);git(tmp,'clone','--bare','-q',source,join(root,'repo.git'));mkdirSync(join(root,'.fervo'));
    const plain=await loadServerExtensions(root);
    assert.deepEqual(plain.loaded,['builtin:rules']);assert.deepEqual(Object.keys(plain.rules).sort(),['frontier_gain','human','review','scope','tests']);
    assert.equal(readFileSync(join(root,'.fervo','settings.json'),'utf8'),readFileSync(defaultSettings,'utf8'),'a root without settings gets the default');

    const dir=join(root,'.fervo');mkdirSync(join(dir,'ext'));
    writeFileSync(join(dir,'ext','approve.ts'),"import type { ServerAPI } from 'fervo/extension';\nexport default (fervo: ServerAPI): void => { fervo.registerRule({ name: 'human', evaluate: () => ({ state: 'satisfied' }) }); };\n");
    mkdirSync(join(dir,'node_modules','fervo-rule-extra'),{recursive:true});
    writeFileSync(join(dir,'node_modules','fervo-rule-extra','package.json'),JSON.stringify({name:'fervo-rule-extra',type:'module',exports:{'.':{import:'./index.js'}}}));
    writeFileSync(join(dir,'node_modules','fervo-rule-extra','index.js'),"export default async fervo => { await null; fervo.registerRule({ name: 'extra', evaluate: () => ({ state: 'pending' }) }); };\n");
    writeFileSync(join(dir,'ext','broken.ts'),"export default (): void => { throw new Error('boom'); };\n");
    writeFileSync(join(dir,'ext','duplicate.ts'),"export default (fervo: any): void => { fervo.registerRule({ name: 'extra', evaluate: () => ({ state: 'satisfied' }) }); };\n");
    writeFileSync(join(dir,'ext','named.ts'),"export const rule = 1;\n");
    const settings=(value:unknown)=>writeFileSync(join(dir,'settings.json'),JSON.stringify(value));

    settings({extensions:['./ext/approve.ts','fervo-rule-extra']});
    const extended=await loadServerExtensions(root);
    assert.deepEqual(extended.loaded,['builtin:rules','./ext/approve.ts','fervo-rule-extra']);
    assert.deepEqual(Object.keys(extended.rules).sort(),['extra','frontier_gain','human','review','scope','tests']);

    const db=openDb(root);const at=new Date().toISOString();
    for(const [id,kind] of [['agent','agent'],['runner','runner']])db.prepare('INSERT INTO actors(id,kind,token_hash,created_at) VALUES(?,?,?,?)').run(id,kind,id,at);
    const builtIn=new State(db,join(root,'repo.git'),root,builtinServerExtensions);
    const base=bareGit(builtIn.repo,'rev-parse','refs/heads/main');db.prepare('INSERT INTO nodes(id,commit_sha,author,intent,scope,changed_paths,state,score_mean,merged_as,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('n_0',base,'agent','baseline','[]','[]','merged',1,base,at);
    const claim=builtIn.write({id:'agent',kind:'agent'},'/claims',{parent:'n_0',scope:['score.txt'],intent:'raise'}) as {lease:string};
    writeFileSync(join(source,'score.txt'),'12\n');git(source,'commit','-qam','raise');const commit=git(source,'rev-parse','HEAD');git(source,'push','-q',builtIn.repo,`HEAD:refs/heads/agents/agent/${claim.lease}`);
    const node=(builtIn.write({id:'agent',kind:'agent'},'/submit',{lease:claim.lease,commit}) as {node:string}).node;
    const job=builtIn.lease({id:'runner',kind:'runner'}) as {id:string};
    builtIn.result({id:'runner',kind:'runner'},job.id,{verdicts:[{producer:'tests',provider:null,passed:true,samples:null,evidence:'tests passed',recipe_hash:'test'},{producer:'gain',provider:null,passed:null,samples:[.2,.2,.2],evidence:'paired gain',recipe_hash:'test'}]});
    assert.equal((builtIn.status(node) as {state:string}).state,'verified','the built-in human rule waits for a human');
    new State(db,join(root,'repo.git'),root,extended).policy(node);
    assert.equal((builtIn.status(node) as {state:string}).state,'merged','the replacement rule is the one policy evaluates');
    assert.equal(bareGit(builtIn.repo,'rev-parse','refs/heads/main'),commit);
    db.close();

    const refused=async(value:unknown,message:RegExp)=>{settings(value);await assert.rejects(loadServerExtensions(root),message);};
    await refused({extensions:['./ext/approve.ts'],disable:['builtin:rules']},/fervo\.toml on main requires rules nothing registers: tests \(registered: human\)/);
    await refused({extensions:['./ext/broken.ts']},/^Error: extension \.\/ext\/broken\.ts: boom$/);
    await refused({extensions:['./ext/missing.ts']},/extension \.\/ext\/missing\.ts: Cannot find module/);
    await refused({extensions:['./ext/named.ts']},/extension \.\/ext\/named\.ts: the default export must be a function/);
    await refused({extensions:['fervo-rule-extra','./ext/duplicate.ts']},/extension \.\/ext\/duplicate\.ts: rule extra is already registered by fervo-rule-extra/);
    await refused({disable:['builtin:rulez']},/disable names unknown built-ins: builtin:rulez \(built-ins: builtin:rules\)/);
    await refused({extension:['./ext/approve.ts']},/settings\.json: [\s\S]*extension/);

    settings({extensions:['./ext/broken.ts']});
    const serve=spawnSync(process.execPath,[cli,'serve','--root',root,'--port','0'],{encoding:'utf8',timeout:10_000});
    assert.notEqual(serve.status,0);assert.match(serve.stderr,/extension \.\/ext\/broken\.ts: boom/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
