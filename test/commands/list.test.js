import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import listCommand from '../../src/commands/list.js';

async function seedSpec(dir, slug, files) {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(specDir, name), content, 'utf8');
  }
}

describe('draftwise list', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-list-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      listCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('shows a friendly message when there are no specs', async () => {
    await listCommand([], { cwd: dir, log: (m) => logs.push(m) });
    expect(logs.join('\n')).toContain('No specs yet');
  });

  it('lists each spec with its status flags and title', async () => {
    await seedSpec(dir, 'collab-albums', {
      'product-spec.md': '# Collaborative Albums\n\nBody.',
      'technical-spec.md': '# Tech\n',
      'tasks.md': '# Tasks\n',
    });
    await seedSpec(dir, 'mute-notifications', {
      'product-spec.md': '# Mute notifications\n\nBody.',
    });

    await listCommand([], { cwd: dir, log: (m) => logs.push(m) });
    const out = logs.join('\n');
    expect(out).toContain('2 specs');
    expect(out).toMatch(/collab-albums.*product · tech · tasks.*Collaborative Albums/);
    expect(out).toMatch(/mute-notifications.*product\b.*Mute notifications/);
  });

  it('marks empty spec dirs as (empty)', async () => {
    await mkdir(join(dir, '.draftwise', 'specs', 'half-baked'), { recursive: true });

    await listCommand([], { cwd: dir, log: (m) => logs.push(m) });
    expect(logs.join('\n')).toContain('(empty)');
  });
});
