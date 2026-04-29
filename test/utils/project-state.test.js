import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectProjectState } from '../../src/utils/project-state.js';

describe('detectProjectState', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-detect-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns greenfield for a completely empty directory', async () => {
    expect(await detectProjectState(dir)).toBe('greenfield');
  });

  it('returns greenfield for a directory with only package.json + lockfile + node_modules', async () => {
    await writeFile(join(dir, 'package.json'), '{"name":"x"}', 'utf8');
    await writeFile(join(dir, 'package-lock.json'), '{}', 'utf8');
    await mkdir(join(dir, 'node_modules', 'x', 'lib'), { recursive: true });
    await writeFile(
      join(dir, 'node_modules', 'x', 'lib', 'index.js'),
      'module.exports = {};',
      'utf8',
    );
    expect(await detectProjectState(dir)).toBe('greenfield');
  });

  it('returns brownfield when a single source file exists at the root', async () => {
    await writeFile(join(dir, 'index.js'), 'console.log(1);', 'utf8');
    expect(await detectProjectState(dir)).toBe('brownfield');
  });

  it('returns brownfield when source files are nested in src/', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'app.ts'), 'export {};', 'utf8');
    expect(await detectProjectState(dir)).toBe('brownfield');
  });

  it('detects Python source files', async () => {
    await writeFile(join(dir, 'app.py'), 'print("hi")', 'utf8');
    expect(await detectProjectState(dir)).toBe('brownfield');
  });

  it('ignores hidden directories like .git, .github, .vscode', async () => {
    await mkdir(join(dir, '.git', 'hooks'), { recursive: true });
    await writeFile(
      join(dir, '.git', 'hooks', 'pre-commit.js'),
      'noop',
      'utf8',
    );
    await mkdir(join(dir, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(dir, '.github', 'workflows', 'ci.js'),
      'noop',
      'utf8',
    );
    expect(await detectProjectState(dir)).toBe('greenfield');
  });

  it('ignores build / cache directories from IGNORE_DIRS', async () => {
    await mkdir(join(dir, 'dist'), { recursive: true });
    await writeFile(join(dir, 'dist', 'bundle.js'), 'compiled', 'utf8');
    await mkdir(join(dir, 'coverage'), { recursive: true });
    await writeFile(join(dir, 'coverage', 'report.js'), 'data', 'utf8');
    expect(await detectProjectState(dir)).toBe('greenfield');
  });

  it('does not count non-source files (md, json, yml, lock)', async () => {
    await writeFile(join(dir, 'README.md'), '# x', 'utf8');
    await writeFile(join(dir, 'tsconfig.json'), '{}', 'utf8');
    await writeFile(join(dir, 'config.yaml'), 'k: v', 'utf8');
    expect(await detectProjectState(dir)).toBe('greenfield');
  });

  it('returns greenfield when readdir fails on the root', async () => {
    expect(await detectProjectState(join(dir, 'nope'))).toBe('greenfield');
  });
});
