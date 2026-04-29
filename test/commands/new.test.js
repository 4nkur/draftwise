import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import newCommand from '../../src/commands/new.js';

const SAMPLE_SCAN = {
  root: '/repo',
  files: ['src/api/albums.ts', 'src/components/AlbumGrid.tsx'],
  packageMeta: {
    name: 'photos',
    dependencies: ['next', '@prisma/client'],
    devDependencies: [],
  },
  frameworks: ['Next.js'],
  orms: ['Prisma'],
  routes: [{ method: 'GET', path: '/albums', file: 'src/api/albums.ts' }],
  components: [{ name: 'AlbumGrid', file: 'src/components/AlbumGrid.tsx' }],
  models: [{ name: 'Album', file: 'prisma/schema.prisma', fields: ['id', 'title'] }],
};

describe('draftwise new', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-new-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if no idea was given', async () => {
    await expect(
      newCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/Missing idea/);
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      newCommand(['add', 'collaborative', 'albums'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('dumps scanner data + idea + 3-phase instruction without writing the spec', async () => {
    await newCommand(['add', 'collab', 'albums'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    const output = logs.join('\n');
    expect(output).toContain('IDEA: add collab albums');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('PHASE 1');
    expect(output).toContain('PHASE 2');
    expect(output).toContain('PHASE 3');
    expect(output).toContain('coding agent should pick this up');

    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'collab-albums', 'product-spec.md')),
    ).rejects.toThrow();
  });

  it('greenfield: dumps PROJECT PLAN instead of SCANNER OUTPUT', async () => {
    await newCommand(['recipe', 'app'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => {
        throw new Error('scan should not be called in greenfield');
      },
      loadConfig: async () => ({ projectState: 'greenfield' }),
      readOverview: async () => '# Recipe app — Greenfield plan\n',
    });

    const out = logs.join('\n');
    expect(out).toContain('PROJECT PLAN');
    expect(out).not.toContain('SCANNER OUTPUT');
    expect(out).toContain('Recipe app');
  });

  it('greenfield: errors if overview.md is empty', async () => {
    await expect(
      newCommand(['feature'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'greenfield' }),
        readOverview: async () => '',
      }),
    ).rejects.toThrow(/overview\.md is missing or empty/);
  });
});
