import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { select } from '@inquirer/prompts';
import { scan as defaultScan } from '../core/scanner.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { SYSTEM, buildPrompt, buildAgentInstruction } from '../ai/prompts/tasks.js';

const DEFAULT_PROMPTS = {
  pickSpec: ({ specs }) =>
    select({
      message: 'Which feature do you want a task breakdown for?',
      choices: specs.map((s) => ({
        name: s.hasTasks ? `${s.slug}  (tasks.md exists — will overwrite)` : s.slug,
        value: s.slug,
      })),
    }),
};

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function compactScan(result) {
  return {
    frameworks: result.frameworks,
    orms: result.orms,
    routes: result.routes,
    components: result.components.slice(0, 50),
    models: result.models,
    fileCount: result.files.length,
    sampleFiles: result.files.slice(0, 30),
  };
}

export default async function tasksCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.log(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;
  const listSpecs = deps.listSpecs ?? defaultListSpecs;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }

  const config = await loadConfig(cwd);
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

  log('Scanning repo...');
  const result = await scan(cwd);
  if (!result.files || result.files.length === 0) {
    throw new Error(
      `No source files found under ${cwd}. Run \`draftwise tasks\` from your repo root.`,
    );
  }
  const scanForPrompt = compactScan(result);

  if (config.mode === 'agent') {
    log('');
    log('Agent mode — handing scanner data + technical spec off to your coding agent.');
    log('');
    log('---');
    log(`SPEC: ${target.slug}`);
    log('');
    log('TECHNICAL SPEC');
    log(technicalSpec);
    log('');
    log('SCANNER OUTPUT');
    log('```json');
    log(JSON.stringify(scanForPrompt, null, 2));
    log('```');
    log('');
    log('PACKAGE METADATA');
    log('```json');
    log(JSON.stringify(result.packageMeta, null, 2));
    log('```');
    log('');
    log('INSTRUCTION');
    log(buildAgentInstruction(target.slug));
    return;
  }

  log(`API mode — calling ${config.provider}...`);
  const tasks = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    system: SYSTEM,
    prompt: buildPrompt({
      technicalSpec,
      scan: scanForPrompt,
      packageMeta: result.packageMeta,
    }),
  });

  await writeFile(target.tasks, tasks, 'utf8');
  log('');
  log(`Wrote .draftwise/specs/${target.slug}/tasks.md`);
  log('Next: pick the first task with no dependencies and start shipping.');
}
