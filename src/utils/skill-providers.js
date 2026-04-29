import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

// One row per AI harness Draftwise's standalone skill targets. Each provider
// reads SKILL.md from its own `<scope>/<provider-dir>/skills/draftwise/`
// directory. Most accept the same SKILL.md format; Claude-only frontmatter
// fields are stripped on the way out — see trimFrontmatterForProvider.
export const PROVIDERS = {
  claude: { providerDir: '.claude', label: 'Claude Code' },
  cursor: { providerDir: '.cursor', label: 'Cursor' },
  gemini: { providerDir: '.gemini', label: 'Gemini CLI' },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

// Frontmatter keys Claude Code reads but other providers ignore (or trip on).
// Trimmed when writing SKILL.md to non-Claude provider dirs.
const CLAUDE_ONLY_FRONTMATTER_KEYS = new Set([
  'user-invocable',
  'argument-hint',
  'allowed-tools',
]);

export function resolveProviderTarget({ provider, scope, cwd, home = homedir() }) {
  const meta = PROVIDERS[provider];
  if (!meta) {
    throw new Error(
      `Unknown provider "${provider}". Known providers: ${PROVIDER_NAMES.join(', ')}.`,
    );
  }
  const root = scope === 'project' ? cwd : home;
  return join(root, meta.providerDir, 'skills', 'draftwise');
}

// Splits a SKILL.md (or any markdown with YAML frontmatter) into its
// frontmatter object and body string. Returns null frontmatter if the file
// has no frontmatter block — caller decides what to do.
export function splitFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  const frontmatter = yamlParse(match[1]) ?? {};
  return { frontmatter, body: match[2] };
}

export function joinFrontmatter(frontmatter, body) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return body;
  // yamlStringify ends with a trailing newline; trim it so the closing `---`
  // sits flush against the last frontmatter line.
  const fmBlock = yamlStringify(frontmatter).replace(/\n+$/, '');
  return `---\n${fmBlock}\n---\n${body}`;
}

// Returns SKILL.md content prepared for the target provider. Claude gets the
// source unchanged; other providers get a copy with Claude-only frontmatter
// keys removed. Body is never modified.
export function transformSkillForProvider(content, provider) {
  if (provider === 'claude') return content;
  const { frontmatter, body } = splitFrontmatter(content);
  if (!frontmatter) return content;
  const trimmed = { ...frontmatter };
  for (const key of CLAUDE_ONLY_FRONTMATTER_KEYS) {
    delete trimmed[key];
  }
  return joinFrontmatter(trimmed, body);
}
