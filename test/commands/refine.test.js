import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import refineCommand from '../../src/commands/refine.js';

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

async function seedSpec(dir, slug, files = {}) {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  if (files.product !== undefined) {
    await writeFile(join(specDir, 'product-spec.md'), files.product, 'utf8');
  }
  if (files.tech !== undefined) {
    await writeFile(join(specDir, 'technical-spec.md'), files.tech, 'utf8');
  }
  if (files.tasks !== undefined) {
    await writeFile(join(specDir, 'tasks.md'), files.tasks, 'utf8');
  }
  return specDir;
}

const baseDeps = (overrides = {}) => ({
  scan: async () => SAMPLE_SCAN,
  loadConfig: async () => ({ projectState: 'brownfield' }),
  ...overrides,
});

describe('draftwise refine', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-refine-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      refineCommand([], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors if no product specs exist (default type)', async () => {
    await expect(
      refineCommand([], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/No product specs found/);
  });

  it('errors on unknown --type value', async () => {
    await expect(
      refineCommand(['--type=summary'], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/Unknown --type/);
  });

  it('rejects unknown flags via parseArgs strict mode', async () => {
    await seedSpec(dir, 'alpha', { product: '# Product\n' });
    await expect(
      refineCommand(['--bogus'], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/Invalid arguments to draftwise refine/);
  });

  it('auto-picks the only product spec', async () => {
    await seedSpec(dir, 'collab-albums', { product: '# Product\n\nThe spec.' });
    await refineCommand(
      [],
      baseDeps({ cwd: dir, log: (m) => logs.push(m) }),
    );
    const out = logs.join('\n');
    expect(out).toContain('Using the only product spec: collab-albums');
    expect(out).toContain('SPEC: collab-albums');
    expect(out).toContain('TYPE: product');
    expect(out).toContain('EXISTING PRODUCT SPEC');
    expect(out).toContain('SCANNER OUTPUT');
    expect(out).toContain('INSTRUCTION');
    expect(out).toContain('refine');
  });

  it('uses the slug arg to pick a specific product spec', async () => {
    await seedSpec(dir, 'alpha', { product: '# A\n' });
    await seedSpec(dir, 'beta', { product: '# B\n' });
    await refineCommand(
      ['beta'],
      baseDeps({ cwd: dir, log: (m) => logs.push(m) }),
    );
    expect(logs.join('\n')).toContain('SPEC: beta');
  });

  it('errors when an unknown slug is requested', async () => {
    await seedSpec(dir, 'alpha', { product: '# A\n' });
    await expect(
      refineCommand(['ghost'], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/No product spec found for "ghost"/);
  });

  it('errors when multiple product specs exist and no slug is given', async () => {
    await seedSpec(dir, 'alpha', { product: '# A\n' });
    await seedSpec(dir, 'beta', { product: '# B\n' });
    await expect(
      refineCommand([], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/Multiple product specs.*Available: alpha, beta/);
  });

  it('errors if the chosen product spec is empty', async () => {
    await seedSpec(dir, 'empty', { product: '' });
    await expect(
      refineCommand([], baseDeps({ cwd: dir, log: () => {} })),
    ).rejects.toThrow(/empty/);
  });

  it('--type=tech filters to specs that have a technical spec and prints product upstream', async () => {
    await seedSpec(dir, 'alpha', { product: '# Product\n' });
    await seedSpec(dir, 'beta', {
      product: '# Product\n\nBeta product body.',
      tech: '# Tech\n\nBeta tech body.',
    });
    await refineCommand(
      ['--type=tech'],
      baseDeps({ cwd: dir, log: (m) => logs.push(m) }),
    );
    const out = logs.join('\n');
    expect(out).toContain('Using the only technical spec: beta');
    expect(out).toContain('TYPE: tech');
    expect(out).toContain('PRODUCT SPEC (source of truth)');
    expect(out).toContain('Beta product body.');
    expect(out).toContain('EXISTING TECHNICAL SPEC');
    expect(out).toContain('Beta tech body.');
    expect(out).toContain('SCANNER OUTPUT');
  });

  it('--type=tasks filters to specs with tasks.md, prints tech upstream, skips scanner', async () => {
    await seedSpec(dir, 'alpha', {
      product: '# P\n',
      tech: '# Tech\n\nAlpha tech body.',
      tasks: '# Tasks\n\n1. Do thing.',
    });
    let scanCalled = false;
    await refineCommand(
      ['--type=tasks'],
      baseDeps({
        cwd: dir,
        log: (m) => logs.push(m),
        scan: async () => {
          scanCalled = true;
          return SAMPLE_SCAN;
        },
      }),
    );
    const out = logs.join('\n');
    expect(scanCalled).toBe(false);
    expect(out).toContain('TYPE: tasks');
    expect(out).toContain('TECHNICAL SPEC (source of truth)');
    expect(out).toContain('Alpha tech body.');
    expect(out).toContain('EXISTING TASKS');
    expect(out).toContain('Do thing.');
    expect(out).not.toContain('SCANNER OUTPUT');
    expect(out).not.toContain('PROJECT PLAN');
  });

  it('greenfield product: skips scanner, dumps PROJECT PLAN', async () => {
    await seedSpec(dir, 'collab-albums', { product: '# Product\n' });
    let scanCalled = false;
    await refineCommand(
      [],
      baseDeps({
        cwd: dir,
        log: (m) => logs.push(m),
        scan: async () => {
          scanCalled = true;
          return SAMPLE_SCAN;
        },
        loadConfig: async () => ({ projectState: 'greenfield' }),
        readOverview: async () => '# Plan\n\nNext.js + Prisma\n',
      }),
    );
    expect(scanCalled).toBe(false);
    const out = logs.join('\n');
    expect(out).toContain('PROJECT PLAN');
    expect(out).not.toContain('SCANNER OUTPUT');
  });

  it('--type=tech errors if the product spec is missing', async () => {
    const specDir = join(dir, '.draftwise', 'specs', 'orphan');
    await mkdir(specDir, { recursive: true });
    await writeFile(join(specDir, 'technical-spec.md'), '# Tech\n', 'utf8');
    await expect(
      refineCommand(
        ['--type=tech'],
        baseDeps({ cwd: dir, log: () => {} }),
      ),
    ).rejects.toThrow(/product-spec\.md is missing/);
  });

  it('--type=tasks errors if the technical spec is missing', async () => {
    const specDir = join(dir, '.draftwise', 'specs', 'orphan');
    await mkdir(specDir, { recursive: true });
    await writeFile(join(specDir, 'tasks.md'), '# Tasks\n', 'utf8');
    await expect(
      refineCommand(
        ['--type=tasks'],
        baseDeps({ cwd: dir, log: () => {} }),
      ),
    ).rejects.toThrow(/technical-spec\.md is missing/);
  });

  it('does not write to disk', async () => {
    await seedSpec(dir, 'collab-albums', { product: '# Product\n\nBody.' });
    await refineCommand(
      [],
      baseDeps({ cwd: dir, log: () => {} }),
    );
  });

  it('instruction includes the no-fabrication and no-scope-creep rules', async () => {
    await seedSpec(dir, 'alpha', { product: '# Product\n' });
    await refineCommand([], baseDeps({ cwd: dir, log: (m) => logs.push(m) }));
    const out = logs.join('\n');
    expect(out).toMatch(/PHASE 1/);
    expect(out).toMatch(/PHASE 2/);
    expect(out).toMatch(/PHASE 3/);
    expect(out).toMatch(/no fabricated code references/i);
    expect(out).toMatch(/scope creep/i);
  });
});
