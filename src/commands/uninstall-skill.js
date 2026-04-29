import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { pathExists } from '../utils/fs.js';

export const HELP = `draftwise uninstall-skill — remove a standalone Draftwise skill install

Usage:
  draftwise uninstall-skill                  # remove ~/.claude/skills/draftwise/
  draftwise uninstall-skill --scope=project  # remove <cwd>/.claude/skills/draftwise/

Flags:
  --scope=<user|project>     Which install to remove (default: user)

Removes only the standalone skill dir created by \`draftwise
install-skill\`. The marketplace plugin (if installed) is untouched —
manage that via Claude Code's /plugin uninstall.
`;

const ARG_OPTIONS = {
  scope: { type: 'string' },
};

function resolveTarget(scope, cwd, home) {
  if (scope === 'project') return join(cwd, '.claude', 'skills', 'draftwise');
  return join(home, '.claude', 'skills', 'draftwise');
}

export default async function uninstallSkillCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((m) => console.log(m));
  const home = deps.home ?? homedir();

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
      `Invalid arguments to draftwise uninstall-skill: ${err.message}`,
      { cause: err },
    );
  }

  const scope = parsed.values.scope ?? 'user';
  if (scope !== 'user' && scope !== 'project') {
    throw new Error(
      `Invalid --scope value: ${scope}. Use --scope=user or --scope=project.`,
    );
  }

  const target = resolveTarget(scope, cwd, home);
  if (!(await pathExists(target))) {
    throw new Error(
      `No standalone Draftwise skill at ${target}. (Wrong --scope?)`,
    );
  }

  await rm(target, { recursive: true, force: true });
  log(`Removed ${target}`);
}
