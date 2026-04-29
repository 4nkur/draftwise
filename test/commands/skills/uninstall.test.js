import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathExists } from '../../../src/utils/fs.js';
import skillsUninstall from '../../../src/commands/skills/uninstall.js';

describe('draftwise skills uninstall', () => {
  let workspace;
  let home;
  let cwd;
  let logs;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'draftwise-skills-uninstall-'));
    home = join(workspace, 'home');
    cwd = join(workspace, 'project');
    await mkdir(home, { recursive: true });
    await mkdir(cwd, { recursive: true });
    logs = [];
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  function deps(extra = {}) {
    return { cwd, home, log: (m) => logs.push(m), ...extra };
  }

  async function seedTarget(root, providerDir) {
    const target = join(root, providerDir, 'skills', 'draftwise');
    await mkdir(join(target, 'reference'), { recursive: true });
    await writeFile(join(target, 'SKILL.md'), 'body', 'utf8');
    return target;
  }

  it('removes installs across every harness when --provider is omitted', async () => {
    const claude = await seedTarget(home, '.claude');
    const cursor = await seedTarget(home, '.cursor');
    const gemini = await seedTarget(home, '.gemini');

    await skillsUninstall([], deps());

    expect(await pathExists(claude)).toBe(false);
    expect(await pathExists(cursor)).toBe(false);
    expect(await pathExists(gemini)).toBe(false);
  });

  it('skips harnesses with nothing installed (partial state)', async () => {
    const claude = await seedTarget(home, '.claude');

    await skillsUninstall([], deps());

    expect(await pathExists(claude)).toBe(false);
    const out = logs.join('\n');
    expect(out).toContain('Skipped Cursor');
    expect(out).toContain('Skipped Gemini CLI');
    expect(out).toContain('Done — 1 removed, 2 skipped');
  });

  it('--provider=cursor narrows to one harness', async () => {
    const claude = await seedTarget(home, '.claude');
    const cursor = await seedTarget(home, '.cursor');

    await skillsUninstall(['--provider=cursor'], deps());

    expect(await pathExists(cursor)).toBe(false);
    expect(await pathExists(claude)).toBe(true);
  });

  it('--scope=project removes from <cwd> only', async () => {
    const userTarget = await seedTarget(home, '.claude');
    const projectTarget = await seedTarget(cwd, '.claude');

    await skillsUninstall(['--scope=project', '--provider=claude'], deps());

    expect(await pathExists(projectTarget)).toBe(false);
    expect(await pathExists(userTarget)).toBe(true);
  });

  it('errors when there is nothing to remove anywhere', async () => {
    await expect(skillsUninstall([], deps())).rejects.toThrow(
      /No standalone Draftwise skill found/,
    );
  });

  it('rejects an unknown --provider value', async () => {
    await expect(
      skillsUninstall(['--provider=sublime'], deps()),
    ).rejects.toThrow(/Invalid --provider value "sublime"/);
  });
});
