/**
# Runner Model Providers

Operator-owned model calls for independent judging and code review.

## 1. What This Module Does
Calls Anthropic or OpenAI and returns validated structured decisions.
## 2. Why This Module Exists
Model keys must stay in the runner process, away from the state writer and agents.
## 3. How It Fits in the Architecture
The runner invokes this adapter only after deterministic checks pass.
## 4. Key Concepts
Judge provider differs from the author's provider; diffs are untrusted input.
*/
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';

export const ModelDecision = z.object({ passed: z.boolean().optional(), preference: z.number().min(0).max(1).optional(), evidence: z.string().min(1) });
export type ModelCall = (provider: string, model: string, prompt: string) => Promise<z.output<typeof ModelDecision>>;

export const callModel: ModelCall = async (provider, model, prompt) => {
  let output: string;
  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
    output = response.content.filter(block => block.type === 'text').map(block => block.text).join('');
  } else if (provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({ model, input: prompt });
    output = response.output_text;
  } else throw new Error(`unknown model provider ${provider}`);
  return ModelDecision.parse(JSON.parse(output));
};
