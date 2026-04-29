import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { select } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { isInteractive as defaultIsInteractive } from '../utils/tty.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { buildAgentInstruction } from '../ai/prompts/tasks.js';

export const HELP = `draftwise tasks [<feature>] — break technical spec into ordered work

Usage:
  draftwise tasks                 # auto-pick if exactly one tech spec exists
  draftwise tasks <feature-slug>  # target a specific feature

Reads the technical spec, prints it plus scanner data (brownfield)
or the project plan (greenfield) and an instruction for your coding
agent, which writes tasks.md (numbered tasks with Goal / Files /
Depends on / Parallel with / Acceptance). In greenfield, the first
1-3 tasks are project scaffolding (run setup commands, install deps).

Non-TTY (CI, coding-agent shell): when multiple technical specs
exist and no <feature-slug> is supplied, the command errors with
the available slugs instead of running the picker.
`;

const ARG_OPTIONS = {};

const DEFAULT_PROMPTS = {
  pickSpec: ({ specs }) =>
    select({
      message: 'Which feature do you want a task breakdown for?',
      choices: specs.map((s) => ({
        name: s.hasTasks ? `${s.slug}  (tasks.md exists)` : s.slug,
        value: s.slug,
      })),
    }),
};

export default async function tasksCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const listSpecs = deps.listSpecs ?? defaultListSpecs;
  const readOverview = deps.readOverview ?? defaultReadOverview;
  const isInteractive = deps.isInteractive ?? defaultIsInteractive;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  await requireDraftwiseDir(cwd);

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: ARG_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    throw new Error(`Invalid arguments to draftwise tasks: ${err.message}`, {
      cause: err,
    });
  }
  const requestedSlug = parsed.positionals[0];

  const config = await loadConfig(cwd, { log });
  const isGreenfield = config.projectState === 'greenfield';

  const specs = (await listSpecs(cwd)).filter((s) => s.hasTechnicalSpec);
  if (specs.length === 0) {
    throw new Error(
      'No technical specs found in .draftwise/specs/. Run `draftwise tech` first.',
    );
  }

  let target;
  if (requestedSlug) {
    target = specs.find((s) => s.slug === requestedSlug);
    if (!target) {
      const available = specs.map((s) => s.slug).join(', ');
      throw new Error(
        `No technical spec found for "${requestedSlug}". Available: ${available}`,
      );
    }
  } else if (specs.length === 1) {
    target = specs[0];
    log(`Using the only technical spec: ${target.slug}`);
  } else if (isInteractive()) {
    const slug = await prompts.pickSpec({ specs });
    target = specs.find((s) => s.slug === slug);
  } else {
    const available = specs.map((s) => s.slug).join(', ');
    throw new Error(
      `Multiple technical specs exist. Pass one as a positional argument: draftwise tasks <slug>. Available: ${available}`,
    );
  }

  const technicalSpec = await readFile(target.technicalSpec, 'utf8');
  if (!technicalSpec.trim()) {
    throw new Error(
      `${target.slug}/technical-spec.md is empty. Run \`draftwise tech\` to populate it.`,
    );
  }

  const { scanForPrompt, packageMeta, overview } = await loadScanContext({
    cwd,
    config,
    log,
    scan,
    readOverview,
    commandName: 'tasks',
  });

  log('');
  if (isGreenfield) {
    log('Handing project plan + technical spec off to your coding agent.');
  } else {
    log('Handing scanner data + technical spec off to your coding agent.');
  }
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
  log(`SPEC: ${target.slug}`);
  log('');
  log('TECHNICAL SPEC');
  log(technicalSpec);
  log('');
  if (isGreenfield) {
    log('PROJECT PLAN (overview.md)');
    log(overview);
  } else {
    log('SCANNER OUTPUT');
    log('```json');
    log(JSON.stringify(scanForPrompt, null, 2));
    log('```');
    log('');
    log('PACKAGE METADATA');
    log('```json');
    log(JSON.stringify(packageMeta, null, 2));
    log('```');
  }
  log('');
  log('INSTRUCTION');
  log(buildAgentInstruction(target.slug, config.projectState));
}
