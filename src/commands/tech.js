import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { buildAgentInstruction } from '../ai/prompts/tech.js';

export const HELP = `draftwise tech [<feature>] — draft technical-spec.md from a product spec

Usage:
  draftwise tech                 # auto-pick if exactly one product spec exists
  draftwise tech <feature-slug>  # target a specific feature

Reads the product spec, prints it plus scanner data (brownfield) or
the project plan (greenfield) and an instruction for your coding
agent, which writes technical-spec.md grounded in real code or
marked "(new)" for greenfield.

When multiple product specs exist and no <feature-slug> is supplied,
the command errors with the available slugs.
`;

const ARG_OPTIONS = {};

export default async function techCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const listSpecs = deps.listSpecs ?? defaultListSpecs;
  const readOverview = deps.readOverview ?? defaultReadOverview;

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
  const requestedSlug = parsed.positionals[0];

  const config = await loadConfig(cwd, { log });
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

  const { scanForPrompt, packageMeta, overview } = await loadScanContext({
    cwd,
    config,
    log,
    scan,
    readOverview,
    commandName: 'tech',
  });

  log('');
  if (isGreenfield) {
    log('Handing project plan + product spec off to your coding agent.');
  } else {
    log('Handing scanner data + product spec off to your coding agent.');
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
}
