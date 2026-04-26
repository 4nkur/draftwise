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
      maxTokens: undefined,
      projectState: 'brownfield',
      stack: undefined,
      scanMaxFiles: undefined,
    });
  });

  it('reads project state and stack when present', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\nproject:\n  state: greenfield\n  stack: "Next.js + Postgres + Prisma"\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.projectState).toBe('greenfield');
    expect(config.stack).toBe('Next.js + Postgres + Prisma');
  });

  it('defaults projectState to brownfield when missing (back-compat with v0.0.1 configs)', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.projectState).toBe('brownfield');
  });

  it('parses scan.max_files when set', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\nscan:\n  max_files: 10000\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBe(10000);
  });

  it('leaves scanMaxFiles undefined when not set (scanner uses its default)', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBeUndefined();
  });

  it('coerces scan.max_files to a positive integer', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\nscan:\n  max_files: 250.7\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBe(250);
  });

  it('parses ai.max_tokens when set', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\n  max_tokens: 32000\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.maxTokens).toBe(32000);
  });

  it('leaves maxTokens undefined when not set (adapter falls back to default)', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.maxTokens).toBeUndefined();
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
