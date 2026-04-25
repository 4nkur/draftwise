import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

export async function complete({ apiKey, model, system, prompt }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
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
