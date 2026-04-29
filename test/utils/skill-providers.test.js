import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PROVIDERS,
  PROVIDER_NAMES,
  detectInstalledProviders,
  resolveProviderTarget,
  splitFrontmatter,
  joinFrontmatter,
  transformSkillForProvider,
} from '../../src/utils/skill-providers.js';

describe('skill-providers', () => {
  describe('PROVIDERS / PROVIDER_NAMES', () => {
    it('exposes the expected harnesses', () => {
      expect(PROVIDER_NAMES.sort()).toEqual(['claude', 'cursor', 'gemini']);
      for (const name of PROVIDER_NAMES) {
        expect(PROVIDERS[name].providerDir).toMatch(/^\.[a-z-]+$/);
        expect(PROVIDERS[name].label).toBeTruthy();
      }
    });
  });

  describe('resolveProviderTarget', () => {
    it('uses ~/.<provider>/skills/draftwise for user scope', () => {
      const t = resolveProviderTarget({
        provider: 'claude',
        scope: 'user',
        cwd: '/repo',
        home: '/home/u',
      });
      expect(t).toMatch(/[\\/]home[\\/]u[\\/]\.claude[\\/]skills[\\/]draftwise$/);
    });

    it('uses <cwd>/.<provider>/skills/draftwise for project scope', () => {
      const t = resolveProviderTarget({
        provider: 'cursor',
        scope: 'project',
        cwd: '/repo',
        home: '/home/u',
      });
      expect(t).toMatch(/[\\/]repo[\\/]\.cursor[\\/]skills[\\/]draftwise$/);
    });

    it('throws for an unknown provider', () => {
      expect(() =>
        resolveProviderTarget({
          provider: 'sublime',
          scope: 'user',
          cwd: '/repo',
          home: '/home/u',
        }),
      ).toThrow(/Unknown provider "sublime"/);
    });
  });

  describe('detectInstalledProviders', () => {
    let workspace;
    let home;
    let cwd;

    beforeEach(async () => {
      workspace = await mkdtemp(join(tmpdir(), 'draftwise-detect-'));
      home = join(workspace, 'home');
      cwd = join(workspace, 'project');
      await mkdir(home, { recursive: true });
      await mkdir(cwd, { recursive: true });
    });

    afterEach(async () => {
      await rm(workspace, { recursive: true, force: true });
    });

    it('returns an empty list when no provider dirs exist', async () => {
      const found = await detectInstalledProviders({ scope: 'user', cwd, home });
      expect(found).toEqual([]);
    });

    it('returns the providers whose dirs exist at user scope', async () => {
      await mkdir(join(home, '.claude'), { recursive: true });
      await mkdir(join(home, '.gemini'), { recursive: true });
      const found = await detectInstalledProviders({ scope: 'user', cwd, home });
      expect(found.sort()).toEqual(['claude', 'gemini']);
    });

    it('uses <cwd> for project scope, not home', async () => {
      await mkdir(join(home, '.claude'), { recursive: true }); // user-scope decoy
      await mkdir(join(cwd, '.cursor'), { recursive: true });
      const found = await detectInstalledProviders({ scope: 'project', cwd, home });
      expect(found).toEqual(['cursor']);
    });
  });

  describe('splitFrontmatter / joinFrontmatter', () => {
    it('round-trips a SKILL.md with frontmatter', () => {
      const src = `---\nname: x\nversion: 1.0\n---\nbody here\n`;
      const { frontmatter, body } = splitFrontmatter(src);
      expect(frontmatter).toEqual({ name: 'x', version: 1.0 });
      expect(body.trim()).toBe('body here');
      const rebuilt = joinFrontmatter(frontmatter, body);
      expect(rebuilt).toContain('name: x');
      expect(rebuilt).toContain('body here');
    });

    it('returns null frontmatter when the file has no fence', () => {
      const { frontmatter, body } = splitFrontmatter('just body, no frontmatter');
      expect(frontmatter).toBeNull();
      expect(body).toBe('just body, no frontmatter');
    });
  });

  describe('transformSkillForProvider', () => {
    const SKILL = `---
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

    it('returns the source unchanged for the claude provider', () => {
      expect(transformSkillForProvider(SKILL, 'claude')).toBe(SKILL);
    });

    it('strips Claude-only frontmatter for cursor', () => {
      const out = transformSkillForProvider(SKILL, 'cursor');
      expect(out).toContain('name: draftwise');
      expect(out).toContain('description: A test skill');
      expect(out).toContain('version: 0.1.0');
      expect(out).not.toContain('user-invocable');
      expect(out).not.toContain('argument-hint');
      expect(out).not.toContain('allowed-tools');
      expect(out).toContain('Body content');
    });

    it('strips Claude-only frontmatter for gemini', () => {
      const out = transformSkillForProvider(SKILL, 'gemini');
      expect(out).not.toContain('user-invocable');
      expect(out).not.toContain('allowed-tools');
    });

    it('passes through SKILL.md without frontmatter', () => {
      const noFm = 'no fence at all\n';
      expect(transformSkillForProvider(noFm, 'cursor')).toBe(noFm);
    });
  });
});
