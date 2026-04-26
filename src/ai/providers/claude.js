import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
// Bumped from the previous 8192 — synthesis calls (overview, tech spec,
// task breakdown) on richly-scanned repos were getting truncated.
// Override per-config via ai.max_tokens.
const DEFAULT_MAX_TOKENS = 16384;

// SDK's default is 2 retries on 429 / 5xx / network errors. 4 covers
// most transient issues without making rate-limit waits feel hung.
const MAX_RETRIES = 4;

export async function complete({ apiKey, model, system, prompt, maxTokens }) {
  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) {
    throw new Error('Claude returned an empty response.');
  }
  return text;
}
