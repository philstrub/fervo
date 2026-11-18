/**
# Schema Migration Tests

A database opened by a newer Fervo gains the new schema; one written by a newer Fervo is refused.

## 1. What This Module Does
Opens fresh, unversioned, current and too-new databases, and applies a second migration to a version 1 database.
## 2. Why This Module Exists
`CREATE TABLE IF NOT EXISTS` alone let a deployed database silently miss any column added later.
## 3. How It Fits in the Architecture
Calls the store directly; the server and `fervo init` open the database through the same `openDb`.
## 4. Key Concepts
`PRAGMA user_version` counts applied migrations; a failing migration rolls back with the version.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate, migrations, openDb } from '../src/store/db.js';

const columns=(db:Database.Database,table:string)=>(db.pragma(`table_info(${table})`) as {name:string}[]).map(c=>c.name);

test('migrations upgrade old databases in one transaction and refuse newer ones',()=>{
  const root=mkdtempSync(join(tmpdir(),'fervo-migrations-'));
  try {
    mkdirSync(join(root,'.fervo'));
    const path=join(root,'.fervo','fervo.db');
    const unversioned=new Database(path);unversioned.exec(migrations[0]!);
    unversioned.prepare("INSERT INTO events(at,actor,type,subject,data) VALUES('t','operator','initialized','n_0','{}')").run();unversioned.close();
    const db=openDb(root);
    assert.equal(db.pragma('user_version',{simple:true}),migrations.length,'a database from before versioning adopts version 1');
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM events').get() as {n:number}).n,1,'and keeps its rows');
    migrate(db,[...migrations,'ALTER TABLE nodes ADD COLUMN note TEXT']);
    assert.ok(columns(db,'nodes').includes('note'));assert.equal(db.pragma('user_version',{simple:true}),2);
    assert.throws(()=>migrate(db,[...migrations,'ALTER TABLE nodes ADD COLUMN note TEXT','ALTER TABLE nodes ADD COLUMN extra TEXT; ALTER TABLE missing ADD COLUMN x TEXT']),/no such table: missing/);
    assert.equal(db.pragma('user_version',{simple:true}),2,'a failed migration leaves the version');
    assert.ok(!columns(db,'nodes').includes('extra'),'and the schema');
    db.close();
    assert.throws(()=>openDb(root),/database schema version 2 is newer than this Fervo \(1\): upgrade Fervo/);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
