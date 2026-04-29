import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathExists } from '../../src/utils/fs.js';
import uninstallSkill from '../../src/commands/uninstall-skill.js';

describe('draftwise uninstall-skill', () => {
  let workspace;
  let home;
  let cwd;
  let logs;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'draftwise-uninstall-'));
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

  async function seedTarget(root) {
    const target = join(root, '.claude', 'skills', 'draftwise');
    await mkdir(join(target, 'reference'), { recursive: true });
    await writeFile(join(target, 'SKILL.md'), 'body', 'utf8');
    await writeFile(join(target, 'reference', 'init.md'), 'r', 'utf8');
    return target;
  }

  it('removes the user-scope skill dir', async () => {
    const target = await seedTarget(home);
    await uninstallSkill([], deps());
    expect(await pathExists(target)).toBe(false);
  });

  it('removes the project-scope skill dir when --scope=project', async () => {
    const target = await seedTarget(cwd);
    await uninstallSkill(['--scope=project'], deps());
    expect(await pathExists(target)).toBe(false);
  });

  it('errors when there is nothing to remove', async () => {
    await expect(uninstallSkill([], deps())).rejects.toThrow(
      /No standalone Draftwise skill at/,
    );
  });

  it('rejects an unknown --scope value', async () => {
    await expect(uninstallSkill(['--scope=other'], deps())).rejects.toThrow(
      /Invalid --scope value: other/,
    );
  });
});
