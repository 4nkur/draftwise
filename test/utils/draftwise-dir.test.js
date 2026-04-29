import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireDraftwiseDir } from '../../src/utils/draftwise-dir.js';

describe('requireDraftwiseDir', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-dir-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the resolved .draftwise/ path when it exists', async () => {
    await mkdir(join(dir, '.draftwise'));
    expect(await requireDraftwiseDir(dir)).toBe(join(dir, '.draftwise'));
  });

  it('throws the friendly init hint when .draftwise/ is missing', async () => {
    await expect(requireDraftwiseDir(dir)).rejects.toThrow(
      /\.draftwise\/ not found\. Run `draftwise init` first\./,
    );
  });
});
