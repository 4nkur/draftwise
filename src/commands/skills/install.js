import { cp, readFile, rm, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { pathExists } from '../../utils/fs.js';
import {
  PROVIDER_NAMES,
  PROVIDERS,
  resolveProviderTarget,
  transformSkillForProvider,
} from '../../utils/skill-providers.js';

export const HELP = `draftwise skills install — install Draftwise as a standalone slash-command skill

Usage:
  draftwise skills install                       # install for all known harnesses (Claude, Cursor, Gemini)
  draftwise skills install --provider=claude     # install for one harness
  draftwise skills install --scope=project       # install at <cwd>/.<provider>/skills/draftwise/
  draftwise skills install --force               # overwrite existing installs

Flags:
  --provider <claude|cursor|gemini|all>     Which harness(es) to target. Default: all.
  --scope    <user|project>                 user → ~/.<provider>/skills/draftwise/
                                            project → <cwd>/.<provider>/skills/draftwise/
                                            Default: user.
  --force                                   Overwrite an existing draftwise/ skill dir.

Drops a standalone SKILL.md (plus per-verb references) into each
target harness's skill directory. Result: bare /draftwise <verb>
slash form in each harness, matching the CLI binary — no
<plugin>:<skill> namespace prefix. Same SKILL.md goes to each
provider; Claude-only frontmatter fields (user-invocable,
argument-hint, allowed-tools) are stripped for non-Claude providers.

The marketplace plugin (which produces /draftwise:draftwise <verb>
in Claude Code) is independent and untouched.

The npm-installed CLI still drives the work; the skill just shells
out to \`draftwise <verb>\`. All install paths can coexist.
`;

const ARG_OPTIONS = {
  provider: { type: 'string' },
  scope: { type: 'string' },
  force: { type: 'boolean' },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/commands/skills/install.js → ../../../plugin/skills/draftwise/
const DEFAULT_SOURCE_DIR = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'plugin',
  'skills',
  'draftwise',
);

async function copyTreeWithTransform(src, dest, provider) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTreeWithTransform(from, to, provider);
      continue;
    }
    if (!entry.isFile()) continue;
    // SKILL.md gets the per-provider transform; reference files copy verbatim.
    if (entry.name === 'SKILL.md') {
      const raw = await readFile(from, 'utf8');
      await writeFile(to, transformSkillForProvider(raw, provider), 'utf8');
    } else {
      await cp(from, to);
    }
  }
}

function resolveProviderList(flag) {
  if (!flag || flag === 'all') return PROVIDER_NAMES;
  if (!PROVIDER_NAMES.includes(flag)) {
    throw new Error(
      `Invalid --provider value "${flag}". Use one of: ${PROVIDER_NAMES.join(', ')}, all.`,
    );
  }
  return [flag];
}

export default async function skillsInstall(args = [], deps = {}) {
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
      `Invalid arguments to draftwise skills install: ${err.message}`,
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
  const providers = resolveProviderList(parsed.values.provider);

  if (!(await pathExists(sourceDir))) {
    throw new Error(
      `Skill source not found at ${sourceDir}. Try reinstalling draftwise: npm i -g draftwise.`,
    );
  }

  // Fail fast on conflicts before we write anything: if any target dir exists
  // and --force wasn't passed, error with a single message that lists every
  // conflict — friendlier than half-installing then erroring.
  const conflicts = [];
  const targets = [];
  for (const provider of providers) {
    const target = resolveProviderTarget({ provider, scope, cwd, home });
    targets.push({ provider, target });
    if (await pathExists(target)) conflicts.push(target);
  }
  if (conflicts.length > 0 && !force) {
    throw new Error(
      `${conflicts.length === 1 ? 'A target dir already exists' : 'Target dirs already exist'}:\n  ${conflicts.join('\n  ')}\nPass --force to overwrite, or run \`draftwise skills uninstall\` first.`,
    );
  }

  for (const { provider, target } of targets) {
    if (await pathExists(target)) {
      await rm(target, { recursive: true, force: true });
    }
    await copyTreeWithTransform(sourceDir, target, provider);
    log(`Installed Draftwise skill for ${PROVIDERS[provider].label}: ${target}`);
  }

  log('');
  log(
    `Slash command: /draftwise <verb> (in any harness above where Draftwise is on PATH)`,
  );
  log('Try it:        /draftwise init');
}
