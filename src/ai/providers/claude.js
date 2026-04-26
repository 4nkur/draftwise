import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
// Bumped from the previous 8192 — synthesis calls (overview, tech spec,
// task breakdown) on richly-scanned repos were getting truncated.
// Override per-config via ai.max_tokens.
const DEFAULT_MAX_TOKENS = 16384;

// SDK's default is 2 retries on 429 / 5xx / network errors. 4 covers
// most transient issues without making rate-limit waits feel hung.
const MAX_RETRIES = 4;

export async function complete({
  apiKey,
  model,
  system,
  prompt,
  maxTokens,
  onToken,
}) {
  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES });
  const params = {
    model: model || DEFAULT_MODEL,
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: prompt }],
  };

  // Streaming path — feed text deltas to onToken as they arrive, accumulate
  // for the return value. Used by the synthesis commands so users see
  // output live instead of waiting on a frozen line.
  if (typeof onToken === 'function') {
    let accumulated = '';
    const stream = client.messages.stream(params);
    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          accumulated += event.delta.text;
          onToken(event.delta.text);
        }
      }
    } catch (err) {
      // If iteration or onToken throws, ensure the underlying HTTP
      // request is closed before we propagate the error.
      stream.abort?.();
      throw err;
    }
    if (!accumulated) {
      throw new Error('Claude returned an empty response.');
    }
    return accumulated;
  }

  // Non-streaming path — used for JSON / plan calls where live token
  // display would be worse UX than just waiting for the parsed object.
  const response = await client.messages.create(params);
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text) {
    throw new Error('Claude returned an empty response.');
  }
  return text;
}
