import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readConstitution,
  CONSTITUTION_RELATIVE_PATH,
} from '../../src/utils/constitution.js';
import { CONSTITUTION_TEMPLATE } from '../../src/utils/constitution-template.js';

describe('readConstitution', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-constitution-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the file contents when .draftwise/constitution.md exists', async () => {
    await mkdir(join(dir, '.draftwise'), { recursive: true });
    const body = '# Custom constitution\n\n## Voice\n\nBe terse.\n';
    await writeFile(join(dir, '.draftwise', 'constitution.md'), body, 'utf8');

    expect(await readConstitution(dir)).toBe(body);
  });

  it('returns null when the file is absent', async () => {
    expect(await readConstitution(dir)).toBeNull();
  });

  it('returns null when .draftwise/ exists but constitution.md does not', async () => {
    await mkdir(join(dir, '.draftwise'), { recursive: true });
    expect(await readConstitution(dir)).toBeNull();
  });

  it('propagates non-ENOENT I/O errors', async () => {
    // Pass a path that's a directory where a file is expected — readFile
    // surfaces EISDIR (Unix) / EBADF / similar, which is not ENOENT and
    // should bubble up so callers see the real failure instead of silently
    // skipping the constitution.
    await mkdir(join(dir, '.draftwise', 'constitution.md'), { recursive: true });
    await expect(readConstitution(dir)).rejects.toThrow();
  });
});

describe('CONSTITUTION_RELATIVE_PATH', () => {
  it('is the canonical .draftwise/constitution.md path', () => {
    expect(CONSTITUTION_RELATIVE_PATH).toBe('.draftwise/constitution.md');
  });
});

describe('CONSTITUTION_TEMPLATE', () => {
  it('includes the five stable section headings prompts reference by name', () => {
    expect(CONSTITUTION_TEMPLATE).toContain('## Voice');
    expect(CONSTITUTION_TEMPLATE).toContain('## Spec language');
    expect(CONSTITUTION_TEMPLATE).toContain('## Edge case discipline');
    expect(CONSTITUTION_TEMPLATE).toContain('## Project conventions');
    expect(CONSTITUTION_TEMPLATE).toContain('## Domain glossary');
  });
});
