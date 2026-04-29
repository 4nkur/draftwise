import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import scanCommand from '../../src/commands/scan.js';

const SAMPLE_SCAN = {
  root: '/repo',
  files: ['src/index.js', 'src/foo.ts'],
  packageMeta: { name: 'demo', dependencies: ['next'], devDependencies: [] },
  frameworks: ['Next.js'],
  orms: [],
  routes: [{ method: 'GET', path: '/', file: 'app/page.tsx' }],
  components: [{ name: 'Home', file: 'app/page.tsx' }],
  models: [],
};

describe('draftwise scan', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-scan-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      scanCommand([], {
        cwd: dir,
        log: (m) => logs.push(m),
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('prints scanner data and instruction without writing overview.md', async () => {
    await scanCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ projectState: 'brownfield' }),
    });

    const output = logs.join('\n');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('Next.js');
    expect(output).toContain('INSTRUCTION');
    // The orienting prefix lets a plain-terminal user know what to do with
    // the wall of structured output below it.
    expect(output).toContain('coding agent should pick this up');

    await expect(readFile(join(dir, '.draftwise', 'overview.md'))).rejects.toThrow();
  });

  it('short-circuits in greenfield mode with a friendly message', async () => {
    let scanCalled = false;
    await scanCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => {
        scanCalled = true;
        return SAMPLE_SCAN;
      },
      loadConfig: async () => ({ projectState: 'greenfield' }),
    });

    expect(scanCalled).toBe(false);
    const out = logs.join('\n');
    expect(out).toContain('No code yet');
    expect(out).toContain('greenfield plan');
  });

  it('errors when scan returns zero files', async () => {
    await expect(
      scanCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => ({ ...SAMPLE_SCAN, files: [] }),
        loadConfig: async () => ({ projectState: 'brownfield' }),
      }),
    ).rejects.toThrow(/No source files/);
  });
});
