import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/utils/config.js';

describe('loadConfig', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-config-'));
    await mkdir(join(dir, '.draftwise'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads agent mode config', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({
      mode: 'agent',
      provider: undefined,
      apiKeyEnv: undefined,
      model: '',
    });
  });

  it('reads api mode config with provider and api_key_env', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: api\n  provider: claude\n  api_key_env: ANTHROPIC_API_KEY\n  model: ""\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.mode).toBe('api');
    expect(config.provider).toBe('claude');
    expect(config.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
  });

  it('errors when config.yaml is missing', async () => {
    await expect(loadConfig(dir)).rejects.toThrow(/config\.yaml not found/);
  });

  it('errors on invalid mode', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: weird\n',
      'utf8',
    );
    await expect(loadConfig(dir)).rejects.toThrow(/valid `ai\.mode`/);
  });

  it('errors when api mode is missing api_key_env', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: api\n  provider: claude\n',
      'utf8',
    );
    await expect(loadConfig(dir)).rejects.toThrow(/api_key_env/);
  });
});
