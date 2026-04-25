import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import init from '../../src/commands/init.js';

function makePrompter(answers) {
  const queue = [...answers];
  const asked = [];
  return {
    ask: async (question) => {
      asked.push(question);
      return queue.shift() ?? '';
    },
    close: () => {},
    asked,
  };
}

function fakeScan(files) {
  return async (root) => ({ root, files });
}

describe('draftwise init', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-init-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates .draftwise/ skeleton in agent mode', async () => {
    await init([], {
      cwd: dir,
      log: () => {},
      prompter: makePrompter(['agent']),
      scan: fakeScan(['src/foo.js', 'src/bar.ts']),
    });

    const drafts = join(dir, '.draftwise');
    await access(drafts);
    await access(join(drafts, 'specs'));

    const overview = await readFile(join(drafts, 'overview.md'), 'utf8');
    expect(overview).toContain('Codebase overview');

    const config = await readFile(join(drafts, 'config.yaml'), 'utf8');
    expect(config).toContain('mode: agent');
    expect(config).not.toContain('provider:');
    expect(config).not.toContain('api_key_env:');
  });

  it('defaults to agent mode when the user hits enter', async () => {
    await init([], {
      cwd: dir,
      log: () => {},
      prompter: makePrompter(['']),
      scan: fakeScan(['src/foo.js']),
    });

    const config = await readFile(join(dir, '.draftwise', 'config.yaml'), 'utf8');
    expect(config).toContain('mode: agent');
  });

  it('writes provider and default api_key_env in api mode', async () => {
    await init([], {
      cwd: dir,
      log: () => {},
      prompter: makePrompter(['api', 'claude', '']),
      scan: fakeScan(['src/foo.js']),
    });

    const config = await readFile(join(dir, '.draftwise', 'config.yaml'), 'utf8');
    expect(config).toContain('mode: api');
    expect(config).toContain('provider: claude');
    expect(config).toContain('api_key_env: ANTHROPIC_API_KEY');
  });

  it('respects a custom api_key_env name', async () => {
    await init([], {
      cwd: dir,
      log: () => {},
      prompter: makePrompter(['api', 'openai', 'WORK_OPENAI_KEY']),
      scan: fakeScan(['src/foo.js']),
    });

    const config = await readFile(join(dir, '.draftwise', 'config.yaml'), 'utf8');
    expect(config).toContain('provider: openai');
    expect(config).toContain('api_key_env: WORK_OPENAI_KEY');
  });

  it('errors if .draftwise/ already exists', async () => {
    await mkdir(join(dir, '.draftwise'));

    await expect(
      init([], {
        cwd: dir,
        log: () => {},
        prompter: makePrompter([]),
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('errors when the repo has no source files', async () => {
    await expect(
      init([], {
        cwd: dir,
        log: () => {},
        prompter: makePrompter(['agent']),
        scan: fakeScan([]),
      }),
    ).rejects.toThrow(/No source files/);
  });

  it('rejects an invalid AI mode answer', async () => {
    await expect(
      init([], {
        cwd: dir,
        log: () => {},
        prompter: makePrompter(['offline']),
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/Invalid AI mode/);
  });

  it('rejects an invalid provider', async () => {
    await expect(
      init([], {
        cwd: dir,
        log: () => {},
        prompter: makePrompter(['api', 'cohere']),
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/Invalid provider/);
  });
});
