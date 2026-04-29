import { describe, it, expect, vi } from 'vitest';
import { loadScanContext } from '../../src/utils/scan-context.js';

const fakeScanResult = (overrides = {}) => ({
  files: ['src/index.js', 'src/util.js'],
  packageMeta: { name: 'demo', dependencies: ['express'] },
  frameworks: ['Express'],
  orms: [],
  routes: [{ method: 'GET', path: '/health', file: 'src/index.js' }],
  components: [],
  models: [],
  truncated: false,
  maxFiles: 5000,
  ...overrides,
});

describe('loadScanContext — greenfield', () => {
  it('returns the overview and leaves scan fields null', async () => {
    const log = vi.fn();
    const readOverview = vi.fn().mockResolvedValue('# greenfield plan\n\nbody');
    const scan = vi.fn();

    const ctx = await loadScanContext({
      cwd: '/p',
      config: { projectState: 'greenfield' },
      log,
      scan,
      readOverview,
      commandName: 'new',
    });

    expect(ctx).toEqual({
      scanForPrompt: null,
      packageMeta: null,
      overview: '# greenfield plan\n\nbody',
    });
    expect(scan).not.toHaveBeenCalled();
    expect(readOverview).toHaveBeenCalledWith('/p');
    expect(log).toHaveBeenCalledWith('Reading project plan from overview.md...');
  });

  it('throws when overview.md is missing or whitespace-only', async () => {
    const readOverview = vi.fn().mockResolvedValue('   \n  ');
    await expect(
      loadScanContext({
        cwd: '/p',
        config: { projectState: 'greenfield' },
        log: () => {},
        scan: vi.fn(),
        readOverview,
        commandName: 'tech',
      }),
    ).rejects.toThrow(
      /overview\.md is missing or empty.*Re-run `draftwise init`/s,
    );
  });
});

describe('loadScanContext — brownfield', () => {
  it('returns compactScan-shaped projection plus package metadata', async () => {
    const log = vi.fn();
    const scan = vi.fn().mockResolvedValue(fakeScanResult());

    const ctx = await loadScanContext({
      cwd: '/p',
      config: { projectState: 'brownfield', scanMaxFiles: 1000 },
      log,
      scan,
      readOverview: vi.fn(),
      commandName: 'tasks',
    });

    expect(scan).toHaveBeenCalledWith('/p', { maxFiles: 1000 });
    expect(ctx.overview).toBeUndefined();
    expect(ctx.packageMeta).toEqual({ name: 'demo', dependencies: ['express'] });
    // compactScan caps + reshapes; assert the keys we rely on rather than full shape
    expect(ctx.scanForPrompt).toMatchObject({
      frameworks: ['Express'],
      routes: [{ method: 'GET', path: '/health', file: 'src/index.js' }],
      fileCount: 2,
    });
    expect(log).toHaveBeenCalledWith('Scanning repo...');
  });

  it('throws with the command name in the hint when zero source files', async () => {
    const scan = vi.fn().mockResolvedValue(fakeScanResult({ files: [] }));
    await expect(
      loadScanContext({
        cwd: '/p',
        config: { projectState: 'brownfield' },
        log: () => {},
        scan,
        readOverview: vi.fn(),
        commandName: 'tech',
      }),
    ).rejects.toThrow(
      /No source files found under \/p\. Run `draftwise tech` from your repo root\./,
    );
  });

  it('logs scan warnings when truncated', async () => {
    const log = vi.fn();
    const scan = vi
      .fn()
      .mockResolvedValue(fakeScanResult({ truncated: true, maxFiles: 5000 }));

    await loadScanContext({
      cwd: '/p',
      config: { projectState: 'brownfield' },
      log,
      scan,
      readOverview: vi.fn(),
      commandName: 'new',
    });

    const truncationWarningLogged = log.mock.calls.some(([msg]) =>
      typeof msg === 'string' && msg.includes('scanner stopped at 5000'),
    );
    expect(truncationWarningLogged).toBe(true);
  });
});
