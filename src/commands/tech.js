import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { select, confirm } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { pathExists } from '../utils/fs.js';
import { compactScan } from '../utils/scan-projection.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import {
  selectSystem,
  buildPrompt,
  buildAgentInstruction,
} from '../ai/prompts/tech.js';

export const HELP = `draft tech [<feature>] [--force] — draft technical-spec.md from a product spec

Usage:
  draft tech                 # auto-pick if exactly one product spec exists
  draft tech <feature-slug>  # target a specific feature
  draft tech                 # multiple specs → prompts you to pick

Flags:
  --force                        # skip the overwrite confirmation prompt

Reads the product spec, writes technical-spec.md grounded in the
real codebase (brownfield) or the planned directory structure
(greenfield, with "(new)" markers). If technical-spec.md already
exists for the chosen feature, you'll be asked to confirm before
it's overwritten — pass --force to skip the prompt.
`;

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
  confirmOverwrite: ({ slug, file }) =>
    confirm({
      message: `${slug}/${file} already exists. Overwrite?`,
      default: false,
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
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draft init` first.');
  }

  const config = await loadConfig(cwd);
  const isGreenfield = config.projectState === 'greenfield';
  const force = args.includes('--force') || args.includes('-f');
  const positional = args.filter((a) => a !== '--force' && a !== '-f');
  const requestedSlug = positional[0];

  const specs = (await listSpecs(cwd)).filter((s) => s.hasProductSpec);
  if (specs.length === 0) {
    throw new Error(
      'No product specs found in .draftwise/specs/. Run `draft new "<idea>"` first.',
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
  } else {
    const slug = await prompts.pickSpec({ specs });
    target = specs.find((s) => s.slug === slug);
  }

  const productSpec = await readFile(target.productSpec, 'utf8');
  if (!productSpec.trim()) {
    throw new Error(
      `${target.slug}/product-spec.md is empty. Run \`draft new\` to populate it.`,
    );
  }

  // Confirm before clobbering a hand-edited technical-spec.md.
  // Run before the scan so a cancel doesn't waste the scan time.
  // Agent mode is exempt — the host agent does the write, not Draftwise.
  if (
    !force &&
    config.mode !== 'agent' &&
    (await pathExists(target.technicalSpec))
  ) {
    const proceed = await prompts.confirmOverwrite({
      slug: target.slug,
      file: 'technical-spec.md',
    });
    if (!proceed) {
      log(
        'Cancelled. No changes written. (Pass --force to skip this prompt.)',
      );
      return;
    }
  }

  let scanForPrompt;
  let packageMeta;
  let overview;

  if (isGreenfield) {
    log('Reading project plan from overview.md...');
    overview = await readOverview(cwd);
    if (!overview.trim()) {
      throw new Error(
        'Greenfield project but .draftwise/overview.md is missing or empty. Re-run `draft init` to generate the plan.',
      );
    }
    scanForPrompt = null;
    packageMeta = null;
  } else {
    log('Scanning repo...');
    const result = await scan(cwd, { maxFiles: config.scanMaxFiles });
    if (!result.files || result.files.length === 0) {
      throw new Error(
        `No source files found under ${cwd}. Run \`draft tech\` from your repo root.`,
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
    'Next: review, refine, then run `draft tasks` to break it into work items.',
  );
}
