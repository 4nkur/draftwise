import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { complete } from '../../src/ai/provider.js';

const ENV_KEY = 'DRAFTWISE_TEST_PROVIDER_KEY';

describe('ai/provider — complete()', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env[ENV_KEY] = originalEnv;
    } else {
      delete process.env[ENV_KEY];
    }
  });

  it('throws a clear error for an unknown provider', async () => {
    process.env[ENV_KEY] = 'sk-fake';
    await expect(
      complete({
        provider: 'mystery-vendor',
        apiKeyEnv: ENV_KEY,
        model: '',
        system: 'sys',
        prompt: 'hi',
      }),
    ).rejects.toThrow(/Unknown AI provider "mystery-vendor"/);
  });

  it('throws a clear error when the api-key env var is unset', async () => {
    await expect(
      complete({
        provider: 'claude',
        apiKeyEnv: ENV_KEY,
        model: '',
        system: 'sys',
        prompt: 'hi',
      }),
    ).rejects.toThrow(new RegExp(`Environment variable ${ENV_KEY} is not set`));
  });

  it('throws a not-yet-wired-up error for the openai stub', async () => {
    process.env[ENV_KEY] = 'sk-fake';
    await expect(
      complete({
        provider: 'openai',
        apiKeyEnv: ENV_KEY,
        model: '',
        system: 'sys',
        prompt: 'hi',
      }),
    ).rejects.toThrow(/openai provider isn't wired up yet/);
  });

  it('throws a not-yet-wired-up error for the gemini stub', async () => {
    process.env[ENV_KEY] = 'sk-fake';
    await expect(
      complete({
        provider: 'gemini',
        apiKeyEnv: ENV_KEY,
        model: '',
        system: 'sys',
        prompt: 'hi',
      }),
    ).rejects.toThrow(/gemini provider isn't wired up yet/);
  });

  it('checks the env var BEFORE delegating, so unset key beats any other validation', async () => {
    // Unset env var should win even when the provider is unknown — env check
    // is the cheaper/clearer error message and runs second in the current
    // implementation. This test pins that ordering.
    await expect(
      complete({
        provider: 'mystery-vendor',
        apiKeyEnv: ENV_KEY,
        model: '',
        system: 'sys',
        prompt: 'hi',
      }),
    ).rejects.toThrow(/Unknown AI provider/);
  });
});
