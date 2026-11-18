/**
# Authenticated Fervo HTTP Service

The only network and state-writing boundary of a managed repository.

## 1. What This Module Does
Authenticates tokens, serves Git smart HTTP, and dispatches JSON API calls.
## 2. Why This Module Exists
Agents and the runner need one durable, replayable authority for state changes.
## 3. How It Fits in the Architecture
The server owns SQLite and bare Git; the runner and CLI remain clients.
## 4. Key Concepts
`GET /healthz` is the one route without a token: 200 and no data, for a proxy or a supervisor. Clone URLs
come from the operator's `publicUrl`, never from the client's `Host` header. A body is buffered up to 1 MB; a larger one is drained and refused with 413.
Every write has an idempotency key; a repeated body returns its original response, except that a
replayed `token` or `grant` is null: secrets are shown once and only their hashes are stored.
Errors map to statuses here and only here: `FervoError` keeps its own, zod and JSON errors are 400, a
primary-key collision is 409, anything else is a logged 500.
A long poll (`/status/:id?wait`, `/jobs/lease`) re-checks when a commit records an event, at least every
5 s, and stops when its client disconnects: a lease would go to a runner that is gone, and the poll would
outlive `close()`, which closes the database.
*/
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { FervoError } from '../errors.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { gitHttp } from './git.js';
import { State } from './state.js';
import type { ServerExtensions } from './extensions.js';

// Until the next commit that recorded an event, the client leaving, or `ms`. At most 5 s: a job whose lease
// lapses becomes leasable without any write.
function settle(state: State, res: ServerResponse, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined; let left = (): void => {};
  const other = new Promise<void>(resolve => { timer = setTimeout(resolve, Math.min(ms, 5000)); left = resolve; res.once('close', left); });
  return Promise.race([state.committed, other]).finally(() => { clearTimeout(timer); res.off('close', left); });
}

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  // Past 1 MB the body is drained, not buffered: refusing mid-body made the client's write fail with EPIPE instead of reading the 413.
  for await (const chunk of req) { size += chunk.length; if (size <= 1_000_000) chunks.push(Buffer.from(chunk)); }
  if (size > 1_000_000) throw new FervoError(413, 'request body too large');
  const text = Buffer.concat(chunks).toString();
  if (!text) return {};
  try { return JSON.parse(text); } catch (error) { throw new FervoError(400, `invalid JSON body: ${(error as Error).message}`); }
}

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

export function createFervoServer(root: string, publicUrl: string, extensions: ServerExtensions) {
  const db = openDb(root);
  const state = new State(db, join(root, 'repo.git'), root, extensions);
  const server = createServer(async function handler(req, res) {
    try {
      const url = new URL(req.url!, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/healthz') { send(res,200,{}); return; }
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) { send(res,401,{error:'Bearer token required'}); return; }
      const hash = createHash('sha256').update(auth.slice(7)).digest('hex');
      const actor = db.prepare('SELECT * FROM actors WHERE token_hash=? AND disabled=0').get(hash) as Record<string, any> | undefined;
      if (!actor) { send(res,401,{error:'invalid or disabled token'}); return; }
      db.transaction(()=>state.expire())();state.notify();
      if (url.pathname.startsWith('/git/')) { await gitHttp(req,res,root,actor.id,actor.kind); return; }
      if (req.method === 'GET') {
        if (url.pathname === '/whoami') { send(res,200,{actor:state.actor(actor),git_url:`${publicUrl}/git/repo.git`,branch_prefix:state.branchPrefix(actor)}); return; }
        if (url.pathname === '/actors') { if(actor.kind!=='human')throw new FervoError(403,'human token required');send(res,200,(db.prepare('SELECT * FROM actors ORDER BY created_at').all() as Record<string,any>[]).map(a=>state.actor(a)));return; }
        if (url.pathname === '/context') { send(res,200,state.context(actor.id,url.searchParams.getAll('scope')));return; }
        if (url.pathname === '/events') { if(actor.kind!=='human')throw new FervoError(403,'human token required');const after=Number(url.searchParams.get('after') ?? 0);if(!Number.isInteger(after)||after<0)throw new FervoError(400,'after must be a non-negative integer');send(res,200,(db.prepare('SELECT seq,at,actor,type,subject,data FROM events WHERE seq>? ORDER BY seq').all(after) as Record<string,any>[]).map(e=>({...e,data:JSON.parse(e.data)})));return; }
        const status=/^\/status\/([^/]+)$/.exec(url.pathname);
        if(status){const initial=JSON.stringify(state.status(status[1]!));const seconds=Number(url.searchParams.get('wait') ?? 0);if(!Number.isInteger(seconds)||seconds<0||seconds>30)throw new FervoError(400,'wait must be 0 through 30 seconds');if(seconds){const deadline=Date.now()+seconds*1000;while(Date.now()<deadline&&!res.closed&&JSON.stringify(state.status(status[1]!))===initial)await settle(state,res,deadline-Date.now());}if(res.closed)return;send(res,200,state.status(status[1]!));return;}
      }
      if (req.method === 'POST') {
        const key=req.headers['idempotency-key'];
        if(typeof key!=='string'||!key)throw new FervoError(400,'Idempotency-Key required');
        const input=await body(req);
        const digest=createHash('sha256').update(req.method+url.pathname+JSON.stringify(input)).digest('hex');
        if(url.pathname==='/jobs/lease' && !db.prepare('SELECT 1 FROM idempotency WHERE actor=? AND key=?').get(actor.id,key)) {
          if(actor.kind!=='runner')throw new FervoError(403,'runner token required');
          const wait=Number((input as {wait?:number}).wait ?? 30);
          if(!Number.isInteger(wait)||wait<0||wait>30)throw new FervoError(400,'job wait must be 0 through 30 seconds');
          const deadline=Date.now()+wait*1000;
          while(Date.now()<deadline&&!res.closed&&!db.prepare("SELECT 1 FROM jobs WHERE state='queued' OR (state='running' AND lease_until<?) LIMIT 1").get(new Date().toISOString()))await settle(state,res,deadline-Date.now());
          if(res.closed)return;
        }
        const output=db.transaction(()=>{
          const replay=db.prepare('SELECT * FROM idempotency WHERE actor=? AND key=?').get(actor.id,key) as {request_hash:string;response:string}|undefined;
          if(replay){if(replay.request_hash!==digest)throw new FervoError(409,'idempotency key reused with a different request');return JSON.parse(replay.response);}
          let result:unknown;
          if(url.pathname==='/jobs/lease') result=state.lease(actor);
          else if(/^\/jobs\/[^/]+\/heartbeat$/.test(url.pathname))result=state.heartbeat(actor,url.pathname.split('/')[2]!);
          else if(/^\/jobs\/[^/]+\/result$/.test(url.pathname))result=state.result(actor,url.pathname.split('/')[2]!,input);
          else result=state.write(actor,url.pathname,input);
          db.prepare('INSERT INTO idempotency(actor,key,request_hash,response) VALUES(?,?,?,?)').run(actor.id,key,digest,JSON.stringify(result,(field,value)=>field==='token'||field==='grant'?null:value));
          return result;
        })();
        state.notify();
        send(res,200,output);return;
      }
      throw new FervoError(404,'unknown route');
    } catch (error) {
      // A primary-key collision is a client-chosen id that already exists (`actor add`); every other id is random.
      const status=error instanceof FervoError?error.status:error instanceof z.ZodError?400:(error as {code?:string}).code==='SQLITE_CONSTRAINT_PRIMARYKEY'?409:500;
      if(status===500)process.stderr.write(`[handler] ${req.method} ${req.url}: ${error instanceof Error?error.stack:String(error)}\n`);
      send(res,status,{error:error instanceof Error?error.message:String(error)});
    }
  });
  server.on('close',()=>db.close());
  return server;
}
