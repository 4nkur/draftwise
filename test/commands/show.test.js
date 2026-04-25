import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import showCommand from '../../src/commands/show.js';

async function seedSpec(dir, slug, files) {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(specDir, name), content, 'utf8');
  }
}

describe('draftwise show', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-show-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if no slug was given', async () => {
    await expect(
      showCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Usage: draftwise show/);
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      showCommand(['collab-albums'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors when type is invalid', async () => {
    await seedSpec(dir, 'collab-albums', { 'product-spec.md': '# x' });
    await expect(
      showCommand(['collab-albums', 'bogus'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Invalid spec type "bogus"/);
  });

  it('errors when slug is unknown', async () => {
    await seedSpec(dir, 'alpha', { 'product-spec.md': '# x' });
    await expect(
      showCommand(['ghost'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/No spec found for "ghost"/);
  });

  it('errors when the requested type isnt generated yet', async () => {
    await seedSpec(dir, 'alpha', { 'product-spec.md': '# Alpha' });
    await expect(
      showCommand(['alpha', 'tech'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/technical-spec\.md not found/);
  });

  it('shows product spec by default', async () => {
    await seedSpec(dir, 'collab-albums', {
      'product-spec.md': '# Product\n\nProduct body.',
    });

    await showCommand(['collab-albums'], { cwd: dir, log: (m) => logs.push(m) });
    expect(logs.join('\n')).toContain('# Product');
    expect(logs.join('\n')).toContain('Product body.');
  });

  it('shows tech spec when type=tech', async () => {
    await seedSpec(dir, 'collab-albums', {
      'product-spec.md': '# Product',
      'technical-spec.md': '# Tech\n\nTech body.',
    });

    await showCommand(['collab-albums', 'tech'], {
      cwd: dir,
      log: (m) => logs.push(m),
    });
    const out = logs.join('\n');
    expect(out).toContain('# Tech');
    expect(out).not.toContain('Product');
  });

  it('shows tasks when type=tasks', async () => {
    await seedSpec(dir, 'collab-albums', {
      'product-spec.md': '# Product',
      'technical-spec.md': '# Tech',
      'tasks.md': '# Tasks\n\n1. First task',
    });

    await showCommand(['collab-albums', 'tasks'], {
      cwd: dir,
      log: (m) => logs.push(m),
    });
    expect(logs.join('\n')).toContain('1. First task');
  });
});
