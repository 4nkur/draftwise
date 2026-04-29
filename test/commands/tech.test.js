import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import techCommand from '../../src/commands/tech.js';

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

async function seedSpec(dir, slug, productBody = '# Product Spec\n\nBody.') {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  await writeFile(join(specDir, 'product-spec.md'), productBody, 'utf8');
  return specDir;
}

describe('draftwise tech', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-tech-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      techCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors if there are no product specs yet', async () => {
    await expect(
      techCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/No product specs found/);
  });

  it('auto-picks the only spec when there is exactly one', async () => {
    await seedSpec(dir, 'collab-albums');
    await techCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    expect(logs.join('\n')).toContain('Using the only product spec: collab-albums');
  });

  it('uses the slug arg to pick a specific spec when given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await techCommand(['beta'], {
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
      techCommand(['ghost'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/No product spec found for "ghost"/);
  });

  it('prompts the user when there are multiple specs and no slug arg', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await techCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
      prompts: { pickSpec: async () => 'beta' },
    });

    expect(logs.join('\n')).toContain('SPEC: beta');
  });

  it('dumps product spec + scanner + instruction without writing', async () => {
    await seedSpec(dir, 'collab-albums', '# Product\n\nThe spec.');

    await techCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    const output = logs.join('\n');
    expect(output).toContain('SPEC: collab-albums');
    expect(output).toContain('PRODUCT SPEC');
    expect(output).toContain('# Product');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('INSTRUCTION');
    expect(output).toContain('coding agent should pick this up');

    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'collab-albums', 'technical-spec.md')),
    ).rejects.toThrow();
  });

  it('errors if the product spec is empty', async () => {
    await seedSpec(dir, 'empty', '');

    await expect(
      techCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/empty/);
  });

  it('greenfield: skips scanner, reads overview, dumps PROJECT PLAN', async () => {
    await seedSpec(dir, 'collab-albums', '# Product');

    let scanCalled = false;
    await techCommand([], {
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

  describe('non-TTY (flags-driven)', () => {
    function noPrompts() {
      const fail = () => {
        throw new Error('inquirer prompt fired in non-TTY test');
      };
      return { pickSpec: fail };
    }

    it('errors when multiple specs exist and no slug arg, instead of prompting', async () => {
      await seedSpec(dir, 'collab-albums', '# A');
      await seedSpec(dir, 'photo-uploads', '# B');

      await expect(
        techCommand([], {
          cwd: dir,
          log: () => {},
          isInteractive: () => false,
          prompts: noPrompts(),
          scan: async () => SAMPLE_SCAN,
          loadConfig: async () => ({ projectState: 'brownfield' }),
        }),
      ).rejects.toThrow(/Multiple product specs.*Available:.*collab-albums/);
    });
  });
});
