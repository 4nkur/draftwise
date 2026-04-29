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
import skillsInstall from '../../../src/commands/skills/install.js';

const SAMPLE_SKILL = `---
name: draftwise
description: A test skill
version: 0.1.0
user-invocable: true
argument-hint: "<verb> [args]"
allowed-tools:
  - Bash(draftwise *)
---

Body content
`;

async function seedSource(root) {
  const src = join(root, 'plugin-skills', 'draftwise');
  await mkdir(join(src, 'reference'), { recursive: true });
  await writeFile(join(src, 'SKILL.md'), SAMPLE_SKILL, 'utf8');
  await writeFile(join(src, 'reference', 'init.md'), 'init ref\n', 'utf8');
  return src;
}

describe('draftwise skills install', () => {
  let workspace;
  let home;
  let cwd;
  let sourceDir;
  let logs;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'draftwise-skills-install-'));
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

  // Auto-detect needs the provider dir to exist at the scope root. Most tests
  // pre-seed all three so behavior matches the old "install everywhere"
  // baseline; the no-detection / single-detection cases are tested separately
  // below.
  async function seedAllProviderDirs() {
    for (const provider of ['.claude', '.cursor', '.gemini']) {
      await mkdir(join(home, provider), { recursive: true });
    }
  }

  it('auto-detects: installs only to harnesses whose provider dir exists', async () => {
    // Only Claude is "installed" on this machine.
    await mkdir(join(home, '.claude'), { recursive: true });

    await skillsInstall([], deps());

    const claudeSkill = await readFile(
      join(home, '.claude', 'skills', 'draftwise', 'SKILL.md'),
      'utf8',
    );
    expect(claudeSkill).toContain('name: draftwise');
    await expect(
      readFile(join(home, '.cursor', 'skills', 'draftwise', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();
    await expect(
      readFile(join(home, '.gemini', 'skills', 'draftwise', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();

    // The detection log line tells the user *why* only Claude was picked.
    expect(logs.join('\n')).toContain('Detected harness(es): Claude Code');
  });

  it('errors when no provider dir is detected, with a hint to use --provider', async () => {
    await expect(skillsInstall([], deps())).rejects.toThrow(
      /No AI harnesses detected[\s\S]*--provider=all[\s\S]*--provider=<claude\|cursor\|gemini>/,
    );
  });

  it('--provider=all installs to every known harness regardless of detection', async () => {
    // No provider dirs exist — auto-detect would error here, but --provider=all overrides.
    await skillsInstall(['--provider=all'], deps());

    for (const provider of ['.claude', '.cursor', '.gemini']) {
      const target = join(home, provider, 'skills', 'draftwise');
      const skill = await readFile(join(target, 'SKILL.md'), 'utf8');
      expect(skill).toContain('name: draftwise');
      const refs = await readdir(join(target, 'reference'));
      expect(refs).toContain('init.md');
    }
  });

  it('keeps Claude-only frontmatter on Claude, strips it for other providers', async () => {
    await seedAllProviderDirs();
    await skillsInstall([], deps());

    const claude = await readFile(
      join(home, '.claude', 'skills', 'draftwise', 'SKILL.md'),
      'utf8',
    );
    expect(claude).toContain('user-invocable: true');
    expect(claude).toContain('allowed-tools');

    const cursor = await readFile(
      join(home, '.cursor', 'skills', 'draftwise', 'SKILL.md'),
      'utf8',
    );
    expect(cursor).not.toContain('user-invocable');
    expect(cursor).not.toContain('argument-hint');
    expect(cursor).not.toContain('allowed-tools');
    expect(cursor).toContain('name: draftwise');
    expect(cursor).toContain('Body content');
  });

  it('--provider=claude limits the install to one harness', async () => {
    await skillsInstall(['--provider=claude'], deps());

    await readFile(
      join(home, '.claude', 'skills', 'draftwise', 'SKILL.md'),
      'utf8',
    );
    await expect(
      readFile(join(home, '.cursor', 'skills', 'draftwise', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();
    await expect(
      readFile(join(home, '.gemini', 'skills', 'draftwise', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();
  });

  it('--scope=project writes under <cwd>', async () => {
    await skillsInstall(['--scope=project', '--provider=claude'], deps());

    await readFile(
      join(cwd, '.claude', 'skills', 'draftwise', 'SKILL.md'),
      'utf8',
    );
    await expect(
      readFile(join(home, '.claude', 'skills', 'draftwise', 'SKILL.md'), 'utf8'),
    ).rejects.toThrow();
  });

  it('rejects unknown --provider values', async () => {
    await expect(
      skillsInstall(['--provider=sublime'], deps()),
    ).rejects.toThrow(/Invalid --provider value "sublime"/);
  });

  it('rejects unknown --scope values', async () => {
    await expect(
      skillsInstall(['--scope=global'], deps()),
    ).rejects.toThrow(/Invalid --scope value: global/);
  });

  it('refuses to overwrite existing installs without --force, lists every conflict', async () => {
    await seedAllProviderDirs();
    await skillsInstall([], deps());
    await expect(skillsInstall([], deps())).rejects.toThrow(
      /Target dirs already exist[\s\S]*\.claude[\s\S]*\.cursor[\s\S]*\.gemini/,
    );
  });

  it('--force replaces all conflicting installs cleanly', async () => {
    await seedAllProviderDirs();
    await skillsInstall([], deps());
    // Plant a stale file in one of the targets to confirm it's wiped.
    const stale = join(
      home,
      '.cursor',
      'skills',
      'draftwise',
      'reference',
      'stale.md',
    );
    await writeFile(stale, 'old', 'utf8');

    await skillsInstall(['--force'], deps());

    const refs = await readdir(
      join(home, '.cursor', 'skills', 'draftwise', 'reference'),
    );
    expect(refs).not.toContain('stale.md');
    expect(refs).toContain('init.md');
  });

  it('errors clearly when the skill source is missing', async () => {
    await seedAllProviderDirs();
    await rm(sourceDir, { recursive: true, force: true });
    await expect(skillsInstall([], deps())).rejects.toThrow(
      /Skill source not found/,
    );
  });

  it('rejects unknown flags', async () => {
    await expect(skillsInstall(['--bogus'], deps())).rejects.toThrow(
      /Invalid arguments/,
    );
  });
});
