/**
# Fervo State Store

The single-writer event and object store beside a bare Git repository.

## 1. What This Module Does
Creates and opens the SQLite tables used by the server.
## 2. Why This Module Exists
Transactions make object changes, event records, and idempotent replies atomic.
## 3. How It Fits in the Architecture
Only the HTTP server opens this database for writes; the runner is an API client.
## 4. Key Concepts
Events are append-only; state tables hold current lifecycle positions. Actors created by enrollment
record their `owner` (the human who set up the clone) and their harness `session`.
## 5. Migrations
`PRAGMA user_version` is the number of entries of `migrations` applied. Opening a database applies the
missing ones, in order, in one transaction, so a failed migration leaves the old schema intact. A database
whose version exceeds the list was written by a newer Fervo and is refused. A schema change appends a
migration; an applied migration is never edited. Migration 1 is the schema from before versioning, with
`IF NOT EXISTS` so that databases created before then (version 0, tables present) adopt it unchanged.
*/
import Database from 'better-sqlite3';
import { join } from 'node:path';

export function openDb(root: string): Database.Database {
  const db = new Database(join(root, '.fervo', 'fervo.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db, migrations);
  return db;
}

export function migrate(db: Database.Database, list: string[]): void {
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version > list.length) throw new Error(`database schema version ${version} is newer than this Fervo (${list.length}): upgrade Fervo`);
  db.transaction(() => { for (const sql of list.slice(version)) db.exec(sql); db.pragma(`user_version = ${list.length}`); })();
}

export const migrations = [
  `
    CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY, kind TEXT NOT NULL, provider TEXT, model TEXT, harness TEXT, owner TEXT REFERENCES actors(id), session TEXT, token_hash TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS grants(code_hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES actors(id), expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY, holder TEXT NOT NULL REFERENCES actors(id), parent_node TEXT NOT NULL REFERENCES nodes(id), supersedes TEXT REFERENCES nodes(id), intent TEXT NOT NULL, scope TEXT NOT NULL, state TEXT NOT NULL, overlaps_at_grant TEXT NOT NULL, proceed_reason TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, parent_node TEXT REFERENCES nodes(id), claim TEXT REFERENCES claims(id), author TEXT REFERENCES actors(id), intent TEXT NOT NULL, scope TEXT NOT NULL, changed_paths TEXT NOT NULL, state TEXT NOT NULL, outcome TEXT, score_mean REAL, score_lo REAL, score_hi REAL, reason TEXT, supersedes TEXT, merged_as TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS verdicts(id TEXT PRIMARY KEY, node TEXT REFERENCES nodes(id), claim TEXT REFERENCES claims(id), reviewer TEXT NOT NULL REFERENCES actors(id), producer TEXT NOT NULL, provider TEXT, passed INTEGER, samples TEXT, evidence TEXT NOT NULL, recipe_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, kind TEXT NOT NULL, node TEXT REFERENCES nodes(id), claim TEXT REFERENCES claims(id), payload TEXT NOT NULL, state TEXT NOT NULL, runner TEXT REFERENCES actors(id), lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0, result TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency(actor TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(actor,key));
    CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, type TEXT NOT NULL, subject TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS baselines(metric TEXT PRIMARY KEY, commit_sha TEXT NOT NULL, samples TEXT NOT NULL, mean REAL NOT NULL, sd REAL NOT NULL, created_at TEXT NOT NULL);
  `,
];
