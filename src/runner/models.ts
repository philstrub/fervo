/**
# Runner Model Providers

Operator-owned model calls for independent judging and code review.

## 1. What This Module Does
Defines the model call shape, the built-in Anthropic and OpenAI providers, and the token-log middleware.
## 2. Why This Module Exists
Model keys must stay in the runner process, away from the state writer and agents.
## 3. How It Fits in the Architecture
Producers call the runner's model chain: middleware registered by extensions, wrapped around the
provider registered under the requested name (`src/runner/extensions.ts`).
## 4. Key Concepts
Judge provider differs from the author's provider; diffs are untrusted input. Both providers are asked
for JSON that matches the decision schema, so a reply in prose or with a raw newline inside a string cannot
fail the job. The Anthropic budget covers the model's thinking as well as the answer; 800 tokens was cut mid-string.
A reply carries its token usage, so middleware such as a cost cap can account for it. The request carries
the job, whose `author` makes that accounting per author.
*/
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import type { LeaseJob } from '../models.js';

export const ModelDecision = z.object({ passed: z.boolean().optional(), preference: z.number().min(0).max(1).optional(), evidence: z.string().min(1) });
export type ModelRequest = { provider: string; model: string; prompt: string; job: z.output<typeof LeaseJob> };
export type ModelReply = { decision: z.output<typeof ModelDecision>; usage: { input_tokens: number; output_tokens: number } };
export type ModelCall = (request: ModelRequest) => Promise<ModelReply>;
export type ModelMiddleware = (next: ModelCall) => ModelCall;
const schema = { type: 'object', properties: { passed: { type: 'boolean' }, preference: { type: 'number' }, evidence: { type: 'string' } }, required: ['evidence'], additionalProperties: false };

export const anthropic: ModelCall = async ({ model, prompt }) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({ model, max_tokens: 8192, output_config: { format: { type: 'json_schema', schema } }, messages: [{ role: 'user', content: prompt }] });
  const output = response.content.filter(block => block.type === 'text').map(block => block.text).join('');
  return { decision: ModelDecision.parse(JSON.parse(output)), usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens } };
};

export const openai: ModelCall = async ({ model, prompt }) => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({ model, input: prompt, text: { format: { type: 'json_schema', name: 'decision', schema, strict: false } } });
  return { decision: ModelDecision.parse(JSON.parse(response.output_text)), usage: { input_tokens: response.usage!.input_tokens, output_tokens: response.usage!.output_tokens } };
};

// Innermost middleware: one line per provider call, which is what a run's model cost is summed from.
export const tokenLog: ModelMiddleware = next => async function callModel(request) {
  const reply = await next(request);
  process.stderr.write(`[callModel] provider=${request.provider} model=${request.model} input_tokens=${reply.usage.input_tokens} output_tokens=${reply.usage.output_tokens}\n`);
  return reply;
};
