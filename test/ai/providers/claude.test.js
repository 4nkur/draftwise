import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @anthropic-ai/sdk before importing claude.js — vi.mock is hoisted.
const createMock = vi.fn();
const streamMock = vi.fn();
const constructorOpts = [];
vi.mock('@anthropic-ai/sdk', () => {
  // The SDK's default export is a class; new-ing it must work.
  class FakeAnthropic {
    constructor(opts) {
      constructorOpts.push(opts);
      this.messages = { create: createMock, stream: streamMock };
    }
  }
  return { default: FakeAnthropic };
});

const { complete } = await import('../../../src/ai/providers/claude.js');

describe('ai/providers/claude — complete()', () => {
  beforeEach(() => {
    createMock.mockReset();
    streamMock.mockReset();
    constructorOpts.length = 0;
  });

  it('returns concatenated text from a single text block', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello world.' }],
    });
    const out = await complete({
      apiKey: 'sk-fake',
      model: '',
      system: 'sys',
      prompt: 'hi',
    });
    expect(out).toBe('Hello world.');
  });

  it('joins multiple text blocks but ignores non-text blocks', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'First. ' },
        { type: 'tool_use', id: 'tool-1', input: {} },
        { type: 'text', text: 'Second.' },
        { type: 'thinking', thinking: 'should be ignored' },
      ],
    });
    const out = await complete({
      apiKey: 'sk-fake',
      model: '',
      system: 'sys',
      prompt: 'hi',
    });
    expect(out).toBe('First. Second.');
  });

  it('throws when the response has no content array', async () => {
    createMock.mockResolvedValue({ content: [] });
    await expect(
      complete({ apiKey: 'sk-fake', model: '', system: 's', prompt: 'p' }),
    ).rejects.toThrow(/empty response/);
  });

  it('throws when the response contains only non-text blocks', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'tool_use', id: 't', input: {} }],
    });
    await expect(
      complete({ apiKey: 'sk-fake', model: '', system: 's', prompt: 'p' }),
    ).rejects.toThrow(/empty response/);
  });

  it("uses claude-sonnet-4-6 as the default model when none is provided", async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    await complete({ apiKey: 'sk', model: '', system: 's', prompt: 'p' });
    const call = createMock.mock.calls.at(-1)[0];
    expect(call.model).toBe('claude-sonnet-4-6');
  });

  it('respects an explicit model override', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    await complete({
      apiKey: 'sk',
      model: 'claude-opus-4-5',
      system: 's',
      prompt: 'p',
    });
    const call = createMock.mock.calls.at(-1)[0];
    expect(call.model).toBe('claude-opus-4-5');
  });

  it('passes system prompt and user message through unchanged', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    await complete({
      apiKey: 'sk',
      model: '',
      system: 'system instructions here',
      prompt: 'user message body',
    });
    const call = createMock.mock.calls.at(-1)[0];
    expect(call.system).toBe('system instructions here');
    expect(call.messages).toEqual([
      { role: 'user', content: 'user message body' },
    ]);
    expect(call.max_tokens).toBeGreaterThan(0);
  });

  it('uses 16384 as the default max_tokens (synthesis-friendly)', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await complete({ apiKey: 'sk', model: '', system: 's', prompt: 'p' });
    expect(createMock.mock.calls.at(-1)[0].max_tokens).toBe(16384);
  });

  it('respects an explicit maxTokens override', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await complete({
      apiKey: 'sk',
      model: '',
      system: 's',
      prompt: 'p',
      maxTokens: 4096,
    });
    expect(createMock.mock.calls.at(-1)[0].max_tokens).toBe(4096);
  });

  it('configures the SDK with a generous retry budget for transient failures', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await complete({ apiKey: 'sk', model: '', system: 's', prompt: 'p' });
    expect(constructorOpts.at(-1)).toEqual(
      expect.objectContaining({ apiKey: 'sk', maxRetries: 4 }),
    );
  });

  it('propagates SDK errors so callers can handle them', async () => {
    createMock.mockRejectedValue(new Error('429 Too Many Requests'));
    await expect(
      complete({ apiKey: 'sk', model: '', system: 's', prompt: 'p' }),
    ).rejects.toThrow(/429 Too Many Requests/);
  });

  describe('streaming via onToken', () => {
    function fakeStream(events) {
      return {
        async *[Symbol.asyncIterator]() {
          for (const e of events) yield e;
        },
      };
    }

    it('emits each text_delta to onToken and returns the accumulated string', async () => {
      streamMock.mockReturnValue(
        fakeStream([
          { type: 'message_start' },
          { type: 'content_block_start' },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world.' } },
          { type: 'content_block_stop' },
          { type: 'message_stop' },
        ]),
      );

      const tokens = [];
      const result = await complete({
        apiKey: 'sk',
        model: '',
        system: 's',
        prompt: 'p',
        onToken: (chunk) => tokens.push(chunk),
      });

      expect(tokens).toEqual(['Hello ', 'world.']);
      expect(result).toBe('Hello world.');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('ignores non-text-delta events while streaming', async () => {
      streamMock.mockReturnValue(
        fakeStream([
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'A' } },
          { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
          { type: 'content_block_delta', delta: { type: 'text_delta', text: 'B' } },
          { type: 'message_stop' },
        ]),
      );

      const tokens = [];
      const result = await complete({
        apiKey: 'sk',
        model: '',
        system: 's',
        prompt: 'p',
        onToken: (chunk) => tokens.push(chunk),
      });

      expect(tokens).toEqual(['A', 'B']);
      expect(result).toBe('AB');
    });

    it('throws when the stream never emitted any text', async () => {
      streamMock.mockReturnValue(fakeStream([{ type: 'message_stop' }]));
      await expect(
        complete({
          apiKey: 'sk',
          model: '',
          system: 's',
          prompt: 'p',
          onToken: () => {},
        }),
      ).rejects.toThrow(/empty response/);
    });

    it('falls back to non-streaming when no onToken is given', async () => {
      createMock.mockResolvedValue({
        content: [{ type: 'text', text: 'whole thing' }],
      });
      const result = await complete({
        apiKey: 'sk',
        model: '',
        system: 's',
        prompt: 'p',
      });
      expect(result).toBe('whole thing');
      expect(streamMock).not.toHaveBeenCalled();
    });
  });
});
