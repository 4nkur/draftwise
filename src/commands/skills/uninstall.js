import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { pathExists } from '../../utils/fs.js';
import {
  PROVIDER_NAMES,
  PROVIDERS,
  resolveProviderTarget,
} from '../../utils/skill-providers.js';

export const HELP = `draftwise skills uninstall — remove a standalone Draftwise skill install

Usage:
  draftwise skills uninstall                       # remove from all known harnesses
  draftwise skills uninstall --provider=claude     # remove from one harness
  draftwise skills uninstall --scope=project       # remove from <cwd>/.<provider>/skills/draftwise/

Flags:
  --provider <claude|cursor|gemini|all>     Which harness(es) to clean. Default: all.
  --scope    <user|project>                 Match what \`skills install\` used. Default: user.

Removes only the standalone skill dirs created by \`draftwise skills
install\`. Skips harnesses where there's nothing to remove. The
marketplace plugin (if installed) is untouched — manage that via
Claude Code's /plugin uninstall draftwise.
`;

const ARG_OPTIONS = {
  provider: { type: 'string' },
  scope: { type: 'string' },
};

function resolveProviderList(flag) {
  if (!flag || flag === 'all') return PROVIDER_NAMES;
  if (!PROVIDER_NAMES.includes(flag)) {
    throw new Error(
      `Invalid --provider value "${flag}". Use one of: ${PROVIDER_NAMES.join(', ')}, all.`,
    );
  }
  return [flag];
}

export default async function skillsUninstall(args = [], deps = {}) {
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
      `Invalid arguments to draftwise skills uninstall: ${err.message}`,
      { cause: err },
    );
  }

  const scope = parsed.values.scope ?? 'user';
  if (scope !== 'user' && scope !== 'project') {
    throw new Error(
      `Invalid --scope value: ${scope}. Use --scope=user or --scope=project.`,
    );
  }
  const providers = resolveProviderList(parsed.values.provider);

  let removed = 0;
  let skipped = 0;
  for (const provider of providers) {
    const target = resolveProviderTarget({ provider, scope, cwd, home });
    if (!(await pathExists(target))) {
      log(`Skipped ${PROVIDERS[provider].label} (nothing at ${target}).`);
      skipped++;
      continue;
    }
    await rm(target, { recursive: true, force: true });
    log(`Removed Draftwise skill for ${PROVIDERS[provider].label}: ${target}`);
    removed++;
  }

  if (removed === 0) {
    throw new Error(
      `No standalone Draftwise skill found at --scope=${scope} for the requested provider(s). (Wrong --scope?)`,
    );
  }
  log('');
  log(
    `Done — ${removed} removed${skipped > 0 ? `, ${skipped} skipped` : ''}.`,
  );
}
