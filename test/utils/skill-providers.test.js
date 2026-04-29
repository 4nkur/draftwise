import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  PROVIDER_NAMES,
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
