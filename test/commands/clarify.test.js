import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import clarifyCommand from '../../src/commands/clarify.js';

async function seedSpec(dir, slug, body = '# Product Spec\n\nBody.') {
  const specDir = join(dir, '.draftwise', 'specs', slug);
  await mkdir(specDir, { recursive: true });
  await writeFile(join(specDir, 'product-spec.md'), body, 'utf8');
}

describe('draftwise clarify', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-clarify-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      clarifyCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors if there are no product specs yet', async () => {
    await expect(
      clarifyCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/No product specs found/);
  });

  it('auto-picks the only spec when there is exactly one', async () => {
    await seedSpec(dir, 'collab-albums');
    await clarifyCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
    });

    const out = logs.join('\n');
    expect(out).toContain('Using the only product spec: collab-albums');
    expect(out).toContain('SPEC: collab-albums');
    expect(out).toContain('PRODUCT SPEC');
    expect(out).toContain('INSTRUCTION');
  });

  it('uses the slug arg to target a specific spec when given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await clarifyCommand(['beta'], {
      cwd: dir,
      log: (m) => logs.push(m),
    });

    const out = logs.join('\n');
    expect(out).toContain('SPEC: beta');
    expect(out).not.toContain('SPEC: alpha');
  });

  it('errors with the available list when multiple specs exist and no slug given', async () => {
    await seedSpec(dir, 'alpha');
    await seedSpec(dir, 'beta');

    await expect(
      clarifyCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Multiple product specs.*alpha, beta/);
  });

  it('errors when the requested slug does not exist', async () => {
    await seedSpec(dir, 'alpha');

    await expect(
      clarifyCommand(['nope'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/No product spec found for "nope".*Available: alpha/);
  });

  it('errors when the product spec is empty', async () => {
    await seedSpec(dir, 'empty', '   \n');
    await expect(
      clarifyCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/empty/);
  });

  it('prints the audit instruction with the four issue categories', async () => {
    await seedSpec(dir, 'feat');
    await clarifyCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
    });

    const out = logs.join('\n');
    expect(out).toContain('Ambiguities');
    expect(out).toContain('Untested assumptions');
    expect(out).toContain('Internal contradictions');
    expect(out).toContain('Missing edge cases');
    expect(out).toContain('Preserve any frontmatter');
  });

  it('rejects unknown flags via parseArgs strict mode', async () => {
    await seedSpec(dir, 'feat');
    await expect(
      clarifyCommand(['--bogus=yes'], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Invalid arguments to draftwise clarify/);
  });
});
