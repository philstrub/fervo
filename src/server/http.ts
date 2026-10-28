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
Every write has an idempotency key; a repeated body returns its original response.
*/
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { gitHttp } from './git.js';
import { State } from './state.js';

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString();
  if (text.length > 1_000_000) throw new Error('request body too large');
  return text ? JSON.parse(text) : {};
}

function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}

export function createFervoServer(root: string) {
  const db = openDb(root);
  const state = new State(db, join(root, 'repo.git'), root);
  const server = createServer(async (req, res) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) { send(res,401,{error:'Bearer token required'}); return; }
      const hash = createHash('sha256').update(auth.slice(7)).digest('hex');
      const actor = db.prepare('SELECT * FROM actors WHERE token_hash=? AND disabled=0').get(hash) as Record<string, any> | undefined;
      if (!actor) { send(res,401,{error:'invalid or disabled token'}); return; }
      db.transaction(()=>state.expire())();
      const url = new URL(req.url!, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/git/')) { await gitHttp(req,res,root,actor.id,actor.kind); return; }
      if (req.method === 'GET') {
        if (url.pathname === '/whoami') { send(res,200,{actor:state.actor(actor),git_url:`http://${req.headers.host}/git/repo.git`}); return; }
        if (url.pathname === '/actors') { if(actor.kind!=='human')throw new Error('human token required');send(res,200,(db.prepare('SELECT * FROM actors ORDER BY created_at').all() as Record<string,any>[]).map(a=>state.actor(a)));return; }
        if (url.pathname === '/context') { send(res,200,state.context(actor.id,url.searchParams.getAll('scope')));return; }
        const status=/^\/status\/([^/]+)$/.exec(url.pathname);
        if(status){const initial=JSON.stringify(state.status(status[1]!));const seconds=Number(url.searchParams.get('wait') ?? 0);if(!Number.isInteger(seconds)||seconds<0||seconds>30)throw new Error('wait must be 0 through 30 seconds');if(seconds){const deadline=Date.now()+seconds*1000;while(Date.now()<deadline&&JSON.stringify(state.status(status[1]!))===initial)await new Promise(resolve=>setTimeout(resolve,200));}send(res,200,state.status(status[1]!));return;}
      }
      if (req.method === 'POST') {
        const key=req.headers['idempotency-key'];
        if(typeof key!=='string'||!key)throw new Error('Idempotency-Key required');
        const input=await body(req);
        const digest=createHash('sha256').update(req.method+url.pathname+JSON.stringify(input)).digest('hex');
        if(url.pathname==='/jobs/lease' && !db.prepare('SELECT 1 FROM idempotency WHERE actor=? AND key=?').get(actor.id,key)) {
          if(actor.kind!=='runner')throw new Error('runner token required');
          const wait=Number((input as {wait?:number}).wait ?? 30);
          if(!Number.isInteger(wait)||wait<0||wait>30)throw new Error('job wait must be 0 through 30 seconds');
          const deadline=Date.now()+wait*1000;
          while(Date.now()<deadline&&!db.prepare("SELECT 1 FROM jobs WHERE state='queued' OR (state='running' AND lease_until<?) LIMIT 1").get(new Date().toISOString()))await new Promise(resolve=>setTimeout(resolve,200));
        }
        const output=db.transaction(()=>{
          const replay=db.prepare('SELECT * FROM idempotency WHERE actor=? AND key=?').get(actor.id,key) as {request_hash:string;response:string}|undefined;
          if(replay){if(replay.request_hash!==digest)throw new Error('idempotency key reused with a different request');return JSON.parse(replay.response);}
          let result:unknown;
          if(url.pathname==='/jobs/lease') result=state.lease(actor);
          else if(/^\/jobs\/[^/]+\/heartbeat$/.test(url.pathname))result=state.heartbeat(actor,url.pathname.split('/')[2]!);
          else if(/^\/jobs\/[^/]+\/result$/.test(url.pathname))result=state.result(actor,url.pathname.split('/')[2]!,input);
          else result=state.write(actor,url.pathname,input);
          db.prepare('INSERT INTO idempotency(actor,key,request_hash,response) VALUES(?,?,?,?)').run(actor.id,key,digest,JSON.stringify(result));
          return result;
        })();
        send(res,200,output);return;
      }
      send(res,404,{error:'unknown route'});
    } catch (error) { send(res,400,{error:error instanceof Error?error.message:String(error)}); }
  });
  server.on('close',()=>db.close());
  return server;
}
