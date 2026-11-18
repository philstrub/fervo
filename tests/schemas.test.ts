/**
# JSON Schema Tests

`docs/schemas/` holds one JSON Schema per API schema that `fervo` exports, and none that it does not.

## 1. What This Module Does
Converts every zod export of `src/models.ts` with `z.toJSONSchema` and compares it with the committed
file. With `FERVO_WRITE_SCHEMAS=1` (`npm run schemas`) it writes the files instead.
## 2. Why This Module Exists
Clients in other languages read the committed schemas; a change to the API must change them in the same
commit, so it shows in review.
## 3. How It Fits in the Architecture
Reads the built models; `docs/api.md` names each schema by the same name.
## 4. Key Concepts
Schemas are emitted in zod's input mode, which allows unknown properties: the server strips unknown
request fields, and a client should accept response fields added later.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import * as models from '../src/models.js';

const dir=resolve('docs/schemas');
const schemas=Object.fromEntries(Object.entries(models).filter(([,value])=>value instanceof z.ZodType).map(([name,schema])=>{const json=z.toJSONSchema(schema as z.ZodType,{io:'input'});return [`${name}.json`,`${JSON.stringify({$schema:json.$schema,title:name,...json},null,2)}\n`];}));

test('docs/schemas holds the current JSON Schema of every exported API schema',()=>{
  if(process.env.FERVO_WRITE_SCHEMAS==='1'){
    rmSync(dir,{recursive:true,force:true});mkdirSync(dir);
    for(const [file,text] of Object.entries(schemas))writeFileSync(join(dir,file),text);
    console.log(`[schemas] wrote ${Object.keys(schemas).length} files to ${dir}`);
  }
  assert.deepEqual(readdirSync(dir).sort(),Object.keys(schemas).sort(),'run npm run schemas');
  for(const [file,text] of Object.entries(schemas))assert.equal(readFileSync(join(dir,file),'utf8'),text,`${file} is stale: run npm run schemas`);
});
