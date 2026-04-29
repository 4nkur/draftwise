import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import installSkill from '../../src/commands/install-skill.js';

async function seedSource(root) {
  const src = join(root, 'plugin-skills', 'draftwise');
  await mkdir(join(src, 'reference'), { recursive: true });
  await writeFile(
    join(src, 'SKILL.md'),
    '---\nname: draftwise\n---\n\nbody\n',
    'utf8',
  );
  await writeFile(join(src, 'reference', 'init.md'), 'init ref\n', 'utf8');
  await writeFile(join(src, 'reference', 'new.md'), 'new ref\n', 'utf8');
  return src;
}

describe('draftwise install-skill', () => {
  let workspace;
  let home;
  let cwd;
  let sourceDir;
  let logs;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'draftwise-install-'));
    home = join(workspace, 'home');
    cwd = join(workspace, 'project');
    await mkdir(home, { recursive: true });
    await mkdir(cwd, { recursive: true });
    sourceDir = await seedSource(workspace);
    logs = [];
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  function deps(extra = {}) {
    return { cwd, home, sourceDir, log: (m) => logs.push(m), ...extra };
  }

  it('writes SKILL.md and references at user scope by default', async () => {
    await installSkill([], deps());

    const target = join(home, '.claude', 'skills', 'draftwise');
    const skill = await readFile(join(target, 'SKILL.md'), 'utf8');
    expect(skill).toContain('name: draftwise');

    const refs = await readdir(join(target, 'reference'));
    expect(refs.sort()).toEqual(['init.md', 'new.md']);
  });

  it('writes to <cwd>/.claude/skills/draftwise when --scope=project', async () => {
    await installSkill(['--scope=project'], deps());

    const target = join(cwd, '.claude', 'skills', 'draftwise');
    const skill = await readFile(join(target, 'SKILL.md'), 'utf8');
    expect(skill).toContain('name: draftwise');
  });

  it('rejects an unknown --scope value', async () => {
    await expect(installSkill(['--scope=global'], deps())).rejects.toThrow(
      /Invalid --scope value: global/,
    );
  });

  it('refuses to overwrite an existing install without --force', async () => {
    await installSkill([], deps());
    await expect(installSkill([], deps())).rejects.toThrow(/already exists/);
  });

  it('replaces an existing install when --force is passed', async () => {
    await installSkill([], deps());
    const target = join(home, '.claude', 'skills', 'draftwise');
    // Add a stale file that the next install should clear out.
    await writeFile(join(target, 'reference', 'stale.md'), 'old', 'utf8');

    await installSkill(['--force'], deps());

    const refs = await readdir(join(target, 'reference'));
    expect(refs).not.toContain('stale.md');
    expect(refs.sort()).toEqual(['init.md', 'new.md']);
  });

  it('errors clearly when the skill source is missing', async () => {
    await rm(sourceDir, { recursive: true, force: true });
    await expect(installSkill([], deps())).rejects.toThrow(
      /Skill source not found/,
    );
  });

  it('rejects unknown flags', async () => {
    await expect(installSkill(['--scopes=user'], deps())).rejects.toThrow(
      /Invalid arguments/,
    );
  });
});
