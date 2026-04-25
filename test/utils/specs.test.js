import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSpecs } from '../../src/utils/specs.js';

describe('listSpecs', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-specs-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty when .draftwise/specs is missing', async () => {
    expect(await listSpecs(dir)).toEqual([]);
  });

  it('returns empty when specs/ exists but is empty', async () => {
    await mkdir(join(dir, '.draftwise', 'specs'), { recursive: true });
    expect(await listSpecs(dir)).toEqual([]);
  });

  it('lists specs and reports which files exist', async () => {
    const specsDir = join(dir, '.draftwise', 'specs');
    await mkdir(join(specsDir, 'alpha'), { recursive: true });
    await writeFile(join(specsDir, 'alpha', 'product-spec.md'), '# alpha', 'utf8');
    await writeFile(join(specsDir, 'alpha', 'technical-spec.md'), '# tech', 'utf8');

    await mkdir(join(specsDir, 'beta'), { recursive: true });
    await writeFile(join(specsDir, 'beta', 'product-spec.md'), '# beta', 'utf8');

    const specs = await listSpecs(dir);
    expect(specs.map((s) => s.slug)).toEqual(['alpha', 'beta']);
    expect(specs[0].hasProductSpec).toBe(true);
    expect(specs[0].hasTechnicalSpec).toBe(true);
    expect(specs[1].hasProductSpec).toBe(true);
    expect(specs[1].hasTechnicalSpec).toBe(false);
  });
});
