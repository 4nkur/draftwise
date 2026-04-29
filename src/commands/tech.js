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
} from '../ai/prompts/tech.js';

export const HELP = `draftwise tech [<feature>] [--force] — draft technical-spec.md from a product spec

Usage:
  draftwise tech                 # auto-pick if exactly one product spec exists
  draftwise tech <feature-slug>  # target a specific feature
  draftwise tech                 # multiple specs → picks via inquirer (TTY only)

Flags:
  --force, -f                # Skip the overwrite confirmation prompt.

Reads the product spec, writes technical-spec.md grounded in the
real codebase (brownfield) or the planned directory structure
(greenfield, with "(new)" markers). If technical-spec.md already
exists for the chosen feature, you'll be asked to confirm before
it's overwritten — pass --force to skip the prompt. In non-TTY
without --force, the command errors instead of overwriting.

Non-TTY (CI, coding-agent shell): when multiple product specs exist
and no <feature-slug> is supplied, the command errors with the
available slugs instead of running the picker.
`;

const ARG_OPTIONS = {
  force: { type: 'boolean', short: 'f' },
};

const DEFAULT_PROMPTS = {
  pickSpec: ({ specs }) =>
    select({
      message: 'Which feature spec do you want a technical spec for?',
      choices: specs.map((s) => ({
        name: s.hasTechnicalSpec
          ? `${s.slug}  (technical-spec.md exists)`
          : s.slug,
        value: s.slug,
      })),
    }),
};

export default async function techCommand(args = [], deps = {}) {
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
    throw new Error(`Invalid arguments to draftwise tech: ${err.message}`, {
      cause: err,
    });
  }
  const force = Boolean(parsed.values.force);
  const requestedSlug = parsed.positionals[0];

  const config = await loadConfig(cwd);
  const isGreenfield = config.projectState === 'greenfield';

  const specs = (await listSpecs(cwd)).filter((s) => s.hasProductSpec);
  if (specs.length === 0) {
    throw new Error(
      'No product specs found in .draftwise/specs/. Run `draftwise new "<idea>"` first.',
    );
  }

  let target;
  if (requestedSlug) {
    target = specs.find((s) => s.slug === requestedSlug);
    if (!target) {
      const available = specs.map((s) => s.slug).join(', ');
      throw new Error(
        `No product spec found for "${requestedSlug}". Available: ${available}`,
      );
    }
  } else if (specs.length === 1) {
    target = specs[0];
    log(`Using the only product spec: ${target.slug}`);
  } else if (isInteractive()) {
    const slug = await prompts.pickSpec({ specs });
    target = specs.find((s) => s.slug === slug);
  } else {
    const available = specs.map((s) => s.slug).join(', ');
    throw new Error(
      `Multiple product specs exist. Pass one as a positional argument: draftwise tech <slug>. Available: ${available}`,
    );
  }

  const productSpec = await readFile(target.productSpec, 'utf8');
  if (!productSpec.trim()) {
    throw new Error(
      `${target.slug}/product-spec.md is empty. Run \`draftwise new\` to populate it.`,
    );
  }

  // Confirm before clobbering a hand-edited technical-spec.md. Run before the
  // scan so a cancel doesn't waste the scan time. Agent mode is exempt — the
  // host agent does the write, not Draftwise.
  if (config.mode !== 'agent') {
    const proceed = await confirmOverwriteOrCancel({
      targetPath: target.technicalSpec,
      slug: target.slug,
      file: 'technical-spec.md',
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
    commandName: 'tech',
  });

  if (config.mode === 'agent') {
    log('');
    if (isGreenfield) {
      log('Agent mode — handing project plan + product spec off to your coding agent.');
    } else {
      log('Agent mode — handing scanner data + product spec off to your coding agent.');
    }
    log(AGENT_HANDOFF_PREFIX);
    log('');
    log('---');
    log(`SPEC: ${target.slug}`);
    log('');
    log('PRODUCT SPEC');
    log(productSpec);
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
  const techSpec = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    maxTokens: config.maxTokens,
    system: selectSystem(config.projectState),
    prompt: buildPrompt({
      productSpec,
      scan: scanForPrompt,
      packageMeta,
      projectState: config.projectState,
      overview,
    }),
    onToken: (chunk) => process.stdout.write(chunk),
  });
  log('');

  await writeFile(target.technicalSpec, techSpec, 'utf8');
  log('');
  log(`Wrote .draftwise/specs/${target.slug}/technical-spec.md`);
  log(
    'Next: review, refine, then run `draftwise tasks` to break it into work items.',
  );
}
