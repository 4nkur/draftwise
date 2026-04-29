import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import skillsHelp from '../../../src/commands/skills/help.js';

describe('draftwise skills help (state report)', () => {
  let workspace;
  let home;
  let cwd;
  let logs;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'draftwise-skills-help-'));
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

  it('reports "not installed" for every provider/scope when nothing is installed', async () => {
    await skillsHelp([], deps());
    const out = logs.join('\n');
    expect(out).toContain('Claude Code');
    expect(out).toContain('Cursor');
    expect(out).toContain('Gemini CLI');
    expect(out.split('not installed').length - 1).toBe(6); // 3 providers × 2 scopes
  });

  it('reports "installed" for the right rows when a skill exists', async () => {
    const target = join(home, '.cursor', 'skills', 'draftwise');
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'SKILL.md'), 'body', 'utf8');

    await skillsHelp([], deps());
    const out = logs.join('\n');
    // Cursor / user should be installed; everything else still "not installed".
    expect(out).toMatch(/Cursor\s+user\s+installed/);
    expect(out).toMatch(/Claude Code\s+user\s+not installed/);
    expect(out).toMatch(/Gemini CLI\s+project\s+not installed/);
  });

  it('shows the detected-harness set that auto-detect install would target', async () => {
    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(join(cwd, '.gemini'), { recursive: true });

    await skillsHelp([], deps());
    const out = logs.join('\n');
    expect(out).toMatch(/Detected harnesses \(user scope[^)]*\):\s+Claude Code/);
    expect(out).toMatch(/Detected harnesses \(project scope[^)]*\):\s+Gemini CLI/);
  });

  it('reports "none" when no harness dirs exist at a scope', async () => {
    await skillsHelp([], deps());
    const out = logs.join('\n');
    expect(out).toMatch(/Detected harnesses \(user scope[^)]*\):\s+none/);
    expect(out).toMatch(/Detected harnesses \(project scope[^)]*\):\s+none/);
  });
});
