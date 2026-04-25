import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tasksCommand from '../../src/commands/tasks.js';

const SAMPLE_SCAN = {
  root: '/repo',
  files: ['src/api/albums.ts'],
  packageMeta: { name: 'photos', dependencies: ['next'], devDependencies: [] },
  frameworks: ['Next.js'],
  orms: ['Prisma'],
  routes: [{ method: 'GET', path: '/albums', file: 'src/api/albums.ts' }],
  components: [],
  models: [{ name: 'Album', file: 'prisma/schema.prisma', fields: ['id', 'title'] }],
};

async function seedSpec(dir, slug, opts = {}) {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  await writeFile(
    join(specDir, 'product-spec.md'),
    opts.product ?? '# Product\n',
    'utf8',
  );
  if (opts.technical !== null) {
    await writeFile(
      join(specDir, 'technical-spec.md'),
      opts.technical ?? '# Tech\n\nBody.',
      'utf8',
    );
  }
  return specDir;
}

describe('draftwise tasks', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-tasks-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      tasksCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors when there are no technical specs yet', async () => {
    await seedSpec(dir, 'alpha', { technical: null });
    await expect(
      tasksCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/No technical specs found/);
  });

  it('auto-picks the only spec with a technical-spec.md', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# Tech\n\nReal.' });

    let captured;
    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async (req) => {
        captured = req;
        return '# Tasks\n\n1. Schema change';
      },
    });

    expect(logs.join('\n')).toContain('Using the only technical spec: collab-albums');
    expect(captured.system).toContain('tasks.md');
    expect(captured.prompt).toContain('# Tech');

    const tasks = await readFile(
      join(dir, '.draftwise', 'specs', 'collab-albums', 'tasks.md'),
      'utf8',
    );
    expect(tasks).toContain('# Tasks');
  });

  it('uses the slug arg when given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await tasksCommand(['beta'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# Beta tasks',
    });

    const tasks = await readFile(
      join(dir, '.draftwise', 'specs', 'beta', 'tasks.md'),
      'utf8',
    );
    expect(tasks).toBe('# Beta tasks');
  });

  it('errors when an unknown slug is requested', async () => {
    await seedSpec(dir, 'alpha');
    await expect(
      tasksCommand(['ghost'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/No technical spec found for "ghost"/);
  });

  it('skips specs missing a technical-spec.md', async () => {
    await seedSpec(dir, 'alpha', { technical: null });
    await seedSpec(dir, 'beta');

    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# Tasks',
    });

    expect(logs.join('\n')).toContain('Using the only technical spec: beta');
    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'alpha', 'tasks.md')),
    ).rejects.toThrow();
  });

  it('agent mode dumps technical spec + scanner + instruction without writing', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# Tech\n\nReal stuff.' });

    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ mode: 'agent' }),
      complete: async () => {
        throw new Error('should not be called in agent mode');
      },
    });

    const output = logs.join('\n');
    expect(output).toContain('SPEC: collab-albums');
    expect(output).toContain('TECHNICAL SPEC');
    expect(output).toContain('# Tech');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('INSTRUCTION');

    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'collab-albums', 'tasks.md')),
    ).rejects.toThrow();
  });

  it('errors when the technical spec is empty', async () => {
    await seedSpec(dir, 'empty', { technical: '' });

    await expect(
      tasksCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/empty/);
  });
});
