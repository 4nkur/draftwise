import { homedir } from 'node:os';
import { pathExists } from '../../utils/fs.js';
import {
  PROVIDER_NAMES,
  PROVIDERS,
  detectInstalledProviders,
  resolveProviderTarget,
} from '../../utils/skill-providers.js';

export const HELP = `draftwise skills help — list known harnesses and where Draftwise is installed

Usage:
  draftwise skills help

Walks ~/.<provider>/skills/draftwise/ and <cwd>/.<provider>/skills/draftwise/
for each known harness (Claude Code, Cursor, Gemini CLI), reports what's
installed, and prints the auto-detected harness set that
\`draftwise skills install\` (with no --provider flag) would target.
`;

function pad(s, n) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export default async function skillsHelp(_args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((m) => console.log(m));
  const home = deps.home ?? homedir();

  log('Draftwise standalone skill — install state');
  log('');
  log(`${pad('HARNESS', 14)}  ${pad('SCOPE', 8)}  STATE`);
  log(`${'-'.repeat(14)}  ${'-'.repeat(8)}  ${'-'.repeat(40)}`);
  for (const provider of PROVIDER_NAMES) {
    for (const scope of ['user', 'project']) {
      const target = resolveProviderTarget({ provider, scope, cwd, home });
      const exists = await pathExists(target);
      log(
        `${pad(PROVIDERS[provider].label, 14)}  ${pad(scope, 8)}  ${exists ? `installed (${target})` : 'not installed'}`,
      );
    }
  }
  log('');

  const detectedUser = await detectInstalledProviders({
    scope: 'user',
    cwd,
    home,
  });
  const detectedProject = await detectInstalledProviders({
    scope: 'project',
    cwd,
    home,
  });
  const labelList = (names) =>
    names.length === 0 ? 'none' : names.map((n) => PROVIDERS[n].label).join(', ');
  log(
    `Detected harnesses (user scope, --scope=user):     ${labelList(detectedUser)}`,
  );
  log(
    `Detected harnesses (project scope, --scope=project): ${labelList(detectedProject)}`,
  );
  log(
    '`draftwise skills install` (no flag) targets the detected set; pass --provider=all to override.',
  );
  log('');
  log('Install:    draftwise skills install [--provider=<name>] [--scope=<user|project>] [--force]');
  log('Uninstall:  draftwise skills uninstall [--provider=<name>] [--scope=<user|project>]');
  log('');
  log(
    'Slash form after install: /draftwise <verb> (bare, no <plugin>:<skill> namespace).',
  );
}
