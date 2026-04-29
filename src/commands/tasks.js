import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { select } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { confirmOverwriteOrCancel } from '../utils/overwrite-guard.js';
import { isInteractive as defaultIsInteractive } from '../utils/tty.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import {
  selectSystem,
  buildPrompt,
  buildAgentInstruction,
} from '../ai/prompts/tasks.js';

export const HELP = `draftwise tasks [<feature>] [--force] — break technical spec into ordered work

Usage:
  draftwise tasks                 # auto-pick if exactly one tech spec exists
  draftwise tasks <feature-slug>  # target a specific feature

Flags:
  --force, -f                 # Skip the overwrite confirmation prompt.

Generates tasks.md: numbered tasks with Goal / Files / Depends on /
Parallel with / Acceptance, ordered so each task's dependencies
appear before it. In greenfield, the first 1-3 tasks are project
scaffolding (run setup commands, install deps). If tasks.md already
exists for the chosen feature, you'll be asked to confirm before
it's overwritten — pass --force to skip the prompt. In non-TTY
without --force, the command errors instead of overwriting.

Non-TTY (CI, coding-agent shell): when multiple technical specs
exist and no <feature-slug> is supplied, the command errors with
the available slugs instead of running the picker.
`;

const ARG_OPTIONS = {
  force: { type: 'boolean', short: 'f' },
};

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
  const complete = deps.complete ?? defaultComplete;
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
  const force = Boolean(parsed.values.force);
  const requestedSlug = parsed.positionals[0];

  const config = await loadConfig(cwd);
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

  // Confirm before clobbering a hand-edited tasks.md. Run before the scan so a
  // cancel doesn't waste the scan time. Agent mode is exempt — the host agent
  // does the write, not Draftwise.
  if (config.mode !== 'agent') {
    const proceed = await confirmOverwriteOrCancel({
      targetPath: target.tasks,
      slug: target.slug,
      file: 'tasks.md',
      force,
      isInteractive,
      log,
      confirmOverwrite: prompts.confirmOverwrite,
    });
    if (!proceed) return;
  }

  const { scanForPrompt, packageMeta, overview } = await loadScanContext({
    cwd,
    config,
    log,
    scan,
    readOverview,
    commandName: 'tasks',
  });

  if (config.mode === 'agent') {
    log('');
    if (isGreenfield) {
      log('Agent mode — handing project plan + technical spec off to your coding agent.');
    } else {
      log('Agent mode — handing scanner data + technical spec off to your coding agent.');
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
    return;
  }

  log(`API mode — calling ${config.provider}...`);
  log('');
  const tasks = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    maxTokens: config.maxTokens,
    system: selectSystem(config.projectState),
    prompt: buildPrompt({
      technicalSpec,
      scan: scanForPrompt,
      packageMeta,
      projectState: config.projectState,
      overview,
    }),
    onToken: (chunk) => process.stdout.write(chunk),
  });
  log('');

  await writeFile(target.tasks, tasks, 'utf8');
  log('');
  log(`Wrote .draftwise/specs/${target.slug}/tasks.md`);
  log('Next: pick the first task with no dependencies and start shipping.');
}
