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
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors if there are no product specs yet', async () => {
    await expect(
      techCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/No product specs found/);
  });

  it('auto-picks the only spec when there is exactly one', async () => {
    await seedSpec(dir, 'collab-albums');
    let captured;
    await techCommand([], {
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
        return '# Tech\n\nWritten.';
      },
    });

    expect(logs.join('\n')).toContain('Using the only product spec: collab-albums');
    expect(captured.system).toContain('technical-spec.md');
    expect(captured.prompt).toContain('# Product Spec');
    // tech streams the synthesis live to stdout.
    expect(typeof captured.onToken).toBe('function');

    const tech = await readFile(
      join(dir, '.draftwise', 'specs', 'collab-albums', 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Tech\n\nWritten.');
  });

  it('uses the slug arg to pick a specific spec when given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await techCommand(['beta'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# Beta tech',
    });

    const tech = await readFile(
      join(dir, '.draftwise', 'specs', 'beta', 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Beta tech');

    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'alpha', 'technical-spec.md')),
    ).rejects.toThrow();
  });

  it('errors when an unknown slug is requested', async () => {
    await seedSpec(dir, 'alpha');

    await expect(
      techCommand(['ghost'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/No product spec found for "ghost"/);
  });

  it('prompts the user when there are multiple specs and no slug arg', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await techCommand([], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# Beta tech',
      prompts: { pickSpec: async () => 'beta' },
    });

    const tech = await readFile(
      join(dir, '.draftwise', 'specs', 'beta', 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Beta tech');
  });

  it('agent mode dumps product spec + scanner + instruction without writing', async () => {
    await seedSpec(dir, 'collab-albums', '# Product\n\nThe spec.');

    await techCommand([], {
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
    expect(output).toContain('PRODUCT SPEC');
    expect(output).toContain('# Product');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('INSTRUCTION');

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
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/empty/);
  });

  it('greenfield: skips scanner, reads overview, uses greenfield prompts', async () => {
    await seedSpec(dir, 'collab-albums', '# Product\n\nGreenfield product.');

    let scanCalled = false;
    let captured;

    await techCommand([], {
      cwd: dir,
      log: () => {},
      scan: async () => {
        scanCalled = true;
        return SAMPLE_SCAN;
      },
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
        projectState: 'greenfield',
      }),
      readOverview: async () => '# Plan\n\nNext.js + Prisma\n',
      complete: async (req) => {
        captured = req;
        return '# Tech\n\nWith (new) markers.';
      },
    });

    expect(scanCalled).toBe(false);
    expect(captured.system).toContain('GREENFIELD');
    expect(captured.prompt).toContain('Plan');
    expect(captured.prompt).not.toContain('"frameworks"');

    const tech = await readFile(
      join(dir, '.draftwise', 'specs', 'collab-albums', 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toContain('# Tech');
  });

  it('prompts before overwriting an existing technical-spec.md, and bails if user declines', async () => {
    const specDir = await seedSpec(dir, 'collab-albums');
    await writeFile(
      join(specDir, 'technical-spec.md'),
      '# Hand-edited tech spec\n',
      'utf8',
    );

    let promptCalls = 0;
    let completeCalled = false;

    await techCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => {
        completeCalled = true;
        return '# Regenerated tech';
      },
      prompts: {
        confirmOverwrite: async () => {
          promptCalls++;
          return false;
        },
      },
    });

    expect(promptCalls).toBe(1);
    expect(completeCalled).toBe(false);
    expect(logs.join('\n')).toContain('Cancelled');

    // The hand-edited spec must remain on disk untouched.
    const tech = await readFile(
      join(specDir, 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Hand-edited tech spec\n');
  });

  it('overwrites without prompting when --force is passed', async () => {
    const specDir = await seedSpec(dir, 'collab-albums');
    await writeFile(
      join(specDir, 'technical-spec.md'),
      '# Hand-edited tech spec\n',
      'utf8',
    );

    let promptCalls = 0;

    await techCommand(['--force'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# Regenerated tech',
      prompts: {
        confirmOverwrite: async () => {
          promptCalls++;
          return false;
        },
      },
    });

    expect(promptCalls).toBe(0);

    const tech = await readFile(
      join(specDir, 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Regenerated tech');
  });

  it('--force works in any arg position (before or after the slug)', async () => {
    await seedSpec(dir, 'alpha');
    const betaDir = await seedSpec(dir, 'beta');
    await writeFile(
      join(betaDir, 'technical-spec.md'),
      'old',
      'utf8',
    );

    await techCommand(['--force', 'beta'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => '# new',
    });

    const tech = await readFile(join(betaDir, 'technical-spec.md'), 'utf8');
    expect(tech).toBe('# new');
  });

  it('agent mode does not trigger the overwrite prompt (host agent writes the file)', async () => {
    const specDir = await seedSpec(dir, 'collab-albums', '# Product');
    await writeFile(
      join(specDir, 'technical-spec.md'),
      '# Old',
      'utf8',
    );

    let promptCalls = 0;

    await techCommand([], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ mode: 'agent' }),
      complete: async () => '',
      prompts: {
        confirmOverwrite: async () => {
          promptCalls++;
          return false;
        },
      },
    });

    expect(promptCalls).toBe(0);
    // Existing file should still be on disk — agent mode never writes from
    // the CLI; the host agent will handle it.
    const tech = await readFile(
      join(specDir, 'technical-spec.md'),
      'utf8',
    );
    expect(tech).toBe('# Old');
  });

  it('greenfield agent mode: dumps PROJECT PLAN instead of SCANNER OUTPUT', async () => {
    await seedSpec(dir, 'collab-albums', '# Product');

    const localLogs = [];
    await techCommand([], {
      cwd: dir,
      log: (m) => localLogs.push(m),
      scan: async () => {
        throw new Error('should not be called in greenfield agent mode');
      },
      loadConfig: async () => ({
        mode: 'agent',
        projectState: 'greenfield',
      }),
      readOverview: async () => '# Plan\n\nNext.js + Prisma\n',
      complete: async () => {
        throw new Error('should not be called in agent mode');
      },
    });

    const out = localLogs.join('\n');
    expect(out).toContain('PROJECT PLAN');
    expect(out).not.toContain('SCANNER OUTPUT');
  });
});
