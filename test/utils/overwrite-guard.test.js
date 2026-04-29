import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmOverwriteOrCancel } from '../../src/utils/overwrite-guard.js';

describe('confirmOverwriteOrCancel', () => {
  let dir;
  let existing;
  let absent;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-overwrite-'));
    existing = join(dir, 'product-spec.md');
    absent = join(dir, 'missing.md');
    await writeFile(existing, '# previously written', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns true when the target does not exist (nothing to overwrite)', async () => {
    const confirmOverwrite = vi.fn();
    const proceed = await confirmOverwriteOrCancel({
      targetPath: absent,
      slug: 'feat',
      file: 'product-spec.md',
      force: false,
      isInteractive: () => true,
      log: () => {},
      confirmOverwrite,
    });
    expect(proceed).toBe(true);
    expect(confirmOverwrite).not.toHaveBeenCalled();
  });

  it('returns true when --force is passed, even with an existing file', async () => {
    const confirmOverwrite = vi.fn();
    const proceed = await confirmOverwriteOrCancel({
      targetPath: existing,
      slug: 'feat',
      file: 'product-spec.md',
      force: true,
      isInteractive: () => true,
      log: () => {},
      confirmOverwrite,
    });
    expect(proceed).toBe(true);
    expect(confirmOverwrite).not.toHaveBeenCalled();
  });

  it('prompts and returns true when the user confirms in a TTY', async () => {
    const confirmOverwrite = vi.fn().mockResolvedValue(true);
    const proceed = await confirmOverwriteOrCancel({
      targetPath: existing,
      slug: 'feat',
      file: 'product-spec.md',
      force: false,
      isInteractive: () => true,
      log: () => {},
      confirmOverwrite,
    });
    expect(proceed).toBe(true);
    expect(confirmOverwrite).toHaveBeenCalledWith({
      slug: 'feat',
      file: 'product-spec.md',
    });
  });

  it('logs the cancel hint and returns false when the user declines in a TTY', async () => {
    const confirmOverwrite = vi.fn().mockResolvedValue(false);
    const log = vi.fn();
    const proceed = await confirmOverwriteOrCancel({
      targetPath: existing,
      slug: 'feat',
      file: 'product-spec.md',
      force: false,
      isInteractive: () => true,
      log,
      confirmOverwrite,
    });
    expect(proceed).toBe(false);
    expect(log).toHaveBeenCalledWith(
      'Cancelled. No changes written. (Pass --force to skip this prompt.)',
    );
  });

  it('throws in non-TTY when the file exists and --force wasn\'t passed', async () => {
    await expect(
      confirmOverwriteOrCancel({
        targetPath: existing,
        slug: 'feat',
        file: 'product-spec.md',
        force: false,
        isInteractive: () => false,
        log: () => {},
        confirmOverwrite: vi.fn(),
      }),
    ).rejects.toThrow(/feat\/product-spec\.md already exists\. Pass --force/);
  });
});
