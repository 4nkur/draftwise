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

  it('reads a minimal brownfield config', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: brownfield\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({
      projectState: 'brownfield',
      stack: undefined,
      scanMaxFiles: undefined,
    });
  });

  it('reads project state and stack when present', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: greenfield\n  stack: "Next.js + Postgres + Prisma"\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.projectState).toBe('greenfield');
    expect(config.stack).toBe('Next.js + Postgres + Prisma');
  });

  it('defaults projectState to brownfield when missing', async () => {
    await writeFile(join(dir, '.draftwise', 'config.yaml'), '{}\n', 'utf8');
    const config = await loadConfig(dir);
    expect(config.projectState).toBe('brownfield');
  });

  it('parses scan.max_files when set', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: brownfield\nscan:\n  max_files: 10000\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBe(10000);
  });

  it('leaves scanMaxFiles undefined when not set', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: brownfield\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBeUndefined();
  });

  it('coerces scan.max_files to a positive integer', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: brownfield\nscan:\n  max_files: 250.7\n',
      'utf8',
    );
    const config = await loadConfig(dir);
    expect(config.scanMaxFiles).toBe(250);
  });

  it('logs a notice when an orphaned `ai:` block is present', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'ai:\n  mode: agent\nproject:\n  state: brownfield\n',
      'utf8',
    );
    const messages = [];
    const config = await loadConfig(dir, { log: (m) => messages.push(m) });
    expect(config.projectState).toBe('brownfield');
    expect(messages.some((m) => /`ai:` block/.test(m))).toBe(true);
  });

  it('does not log the orphaned-ai notice when no ai block is present', async () => {
    await writeFile(
      join(dir, '.draftwise', 'config.yaml'),
      'project:\n  state: brownfield\n',
      'utf8',
    );
    const messages = [];
    await loadConfig(dir, { log: (m) => messages.push(m) });
    expect(messages.some((m) => /`ai:` block/.test(m))).toBe(false);
  });

  it('errors when config.yaml is missing', async () => {
    await expect(loadConfig(dir)).rejects.toThrow(/config\.yaml not found/);
  });
});
