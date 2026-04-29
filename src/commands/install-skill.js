import { cp, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { pathExists } from '../utils/fs.js';

export const HELP = `draftwise install-skill — install Draftwise as a standalone Claude Code skill

Usage:
  draftwise install-skill                  # install at user scope (~/.claude/skills/draftwise/)
  draftwise install-skill --scope=project  # install at <cwd>/.claude/skills/draftwise/
  draftwise install-skill --force          # overwrite an existing install

Flags:
  --scope=<user|project>     Where to write SKILL.md (default: user)
  --force                    Overwrite an existing draftwise/ skill dir

Drops a standalone SKILL.md (plus per-verb references) directly into
the Claude Code skills directory. Unlike the marketplace plugin —
which Claude Code namespaces as /draftwise:draftwise <verb> — a
standalone install gives you bare slash commands: /draftwise <verb>,
matching the CLI binary.

The npm-installed CLI still drives the work; the skill just shells
out to \`draftwise <verb>\`. The two install paths are independent
and may coexist (you'll see both forms in Claude Code).
`;

const ARG_OPTIONS = {
  scope: { type: 'string' },
  force: { type: 'boolean' },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/commands/install-skill.js → ../../plugin/skills/draftwise/
const DEFAULT_SOURCE_DIR = resolve(
  __dirname,
  '..',
  '..',
  'plugin',
  'skills',
  'draftwise',
);

function resolveTarget(scope, cwd, home) {
  if (scope === 'project') return join(cwd, '.claude', 'skills', 'draftwise');
  return join(home, '.claude', 'skills', 'draftwise');
}

export default async function installSkillCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((m) => console.log(m));
  const home = deps.home ?? homedir();
  const sourceDir = deps.sourceDir ?? DEFAULT_SOURCE_DIR;

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: ARG_OPTIONS,
      allowPositionals: false,
      strict: true,
    });
  } catch (err) {
    throw new Error(
      `Invalid arguments to draftwise install-skill: ${err.message}`,
      { cause: err },
    );
  }

  const scope = parsed.values.scope ?? 'user';
  if (scope !== 'user' && scope !== 'project') {
    throw new Error(
      `Invalid --scope value: ${scope}. Use --scope=user or --scope=project.`,
    );
  }
  const force = Boolean(parsed.values.force);

  if (!(await pathExists(sourceDir))) {
    throw new Error(
      `Skill source not found at ${sourceDir}. Try reinstalling draftwise: npm i -g draftwise.`,
    );
  }

  const target = resolveTarget(scope, cwd, home);
  if (await pathExists(target)) {
    if (!force) {
      throw new Error(
        `${target} already exists. Pass --force to overwrite, or run \`draftwise uninstall-skill\` first.`,
      );
    }
    await rm(target, { recursive: true, force: true });
  }

  await cp(sourceDir, target, { recursive: true });

  log(`Installed Draftwise skill at ${target}`);
  log('');
  log('Slash command:  /draftwise <verb>');
  log('Try it:         /draftwise init');
}
