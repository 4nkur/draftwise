import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { select } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { pathExists } from '../utils/fs.js';
import { compactScan } from '../utils/scan-projection.js';
import {
  selectSystem,
  buildPrompt,
  buildAgentInstruction,
} from '../ai/prompts/tasks.js';

export const HELP = `draftwise tasks [<feature>] — break technical spec into ordered work

Usage:
  draftwise tasks                 # auto-pick if exactly one tech spec exists
  draftwise tasks <feature-slug>  # target a specific feature

Generates tasks.md: numbered tasks with Goal / Files / Depends on /
Parallel with / Acceptance, ordered so each task's dependencies
appear before it. In greenfield, the first 1-3 tasks are project
scaffolding (run setup commands, install deps).
`;

const DEFAULT_PROMPTS = {
  pickSpec: ({ specs }) =>
    select({
      message: 'Which feature do you want a task breakdown for?',
      choices: specs.map((s) => ({
        name: s.hasTasks
          ? `${s.slug}  (tasks.md exists — will overwrite)`
          : s.slug,
        value: s.slug,
      })),
    }),
};

export default async function tasksCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.log(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;
  const listSpecs = deps.listSpecs ?? defaultListSpecs;
  const readOverview = deps.readOverview ?? defaultReadOverview;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }

  const config = await loadConfig(cwd);
  const isGreenfield = config.projectState === 'greenfield';
  const requestedSlug = args[0];

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
  } else {
    const slug = await prompts.pickSpec({ specs });
    target = specs.find((s) => s.slug === slug);
  }

  const technicalSpec = await readFile(target.technicalSpec, 'utf8');
  if (!technicalSpec.trim()) {
    throw new Error(
      `${target.slug}/technical-spec.md is empty. Run \`draftwise tech\` to populate it.`,
    );
  }

  let scanForPrompt;
  let packageMeta;
  let overview;

  if (isGreenfield) {
    log('Reading project plan from overview.md...');
    overview = await readOverview(cwd);
    if (!overview.trim()) {
      throw new Error(
        'Greenfield project but .draftwise/overview.md is missing or empty. Re-run `draftwise init` to generate the plan.',
      );
    }
    scanForPrompt = null;
    packageMeta = null;
  } else {
    log('Scanning repo...');
    const result = await scan(cwd, { maxFiles: config.scanMaxFiles });
    if (!result.files || result.files.length === 0) {
      throw new Error(
        `No source files found under ${cwd}. Run \`draftwise tasks\` from your repo root.`,
      );
    }
    for (const warning of describeScanWarnings(result)) {
      log(warning);
    }
    scanForPrompt = compactScan(result);
    packageMeta = result.packageMeta;
  }

  if (config.mode === 'agent') {
    log('');
    if (isGreenfield) {
      log('Agent mode — handing project plan + technical spec off to your coding agent.');
    } else {
      log('Agent mode — handing scanner data + technical spec off to your coding agent.');
    }
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
