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
        loadConfig: async () => ({ projectState: 'brownfield' }),
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
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/No technical specs found/);
  });

  it('auto-picks the only spec with a technical-spec.md', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# Tech\n\nReal.' });

    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    expect(logs.join('\n')).toContain('Using the only technical spec: collab-albums');
  });

  it('uses the slug arg when given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await tasksCommand(['beta'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    expect(logs.join('\n')).toContain('SPEC: beta');
  });

  it('errors when an unknown slug is requested', async () => {
    await seedSpec(dir, 'alpha');
    await expect(
      tasksCommand(['ghost'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
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
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    expect(logs.join('\n')).toContain('Using the only technical spec: beta');
  });

  it('dumps technical spec + scanner + instruction without writing', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# Tech\n\nReal stuff.' });

    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    const output = logs.join('\n');
    expect(output).toContain('SPEC: collab-albums');
    expect(output).toContain('TECHNICAL SPEC');
    expect(output).toContain('# Tech');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('INSTRUCTION');
    expect(output).toContain('coding agent should pick this up');

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
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/empty/);
  });

  it('greenfield: skips scanner, reads overview, dumps PROJECT PLAN', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# Tech\n\nGreenfield.' });

    let scanCalled = false;
    await tasksCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => {
        scanCalled = true;
        return SAMPLE_SCAN;
      },
      loadConfig: async () => ({ projectState: 'greenfield' }),
      readOverview: async () => '# Plan\n\nNext.js + Prisma\n',
    });

    expect(scanCalled).toBe(false);
    const out = logs.join('\n');
    expect(out).toContain('PROJECT PLAN');
    expect(out).not.toContain('SCANNER OUTPUT');
    expect(out).toContain('Plan');
  });

  it('errors when there are multiple specs and no slug arg', async () => {
    await seedSpec(dir, 'collab-albums', { technical: '# T1' });
    await seedSpec(dir, 'photo-uploads', { technical: '# T2' });

    await expect(
      tasksCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(
      /Multiple technical specs.*Available:.*collab-albums/,
    );
  });
});
