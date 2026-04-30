import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { buildAgentInstruction } from '../ai/prompts/refine.js';

export const HELP = `draftwise refine [<feature>] [--type=<kind>] — re-ground a spec while preserving PM edits

Usage:
  draftwise refine                              # auto-pick if exactly one product spec exists
  draftwise refine <feature-slug>               # target a specific feature (default: product spec)
  draftwise refine <feature-slug> --type=tech   # refine technical-spec.md
  draftwise refine <feature-slug> --type=tasks  # refine tasks.md

Reads the chosen spec plus its source-of-truth (scanner data or
overview.md, plus the upstream spec for tech/tasks) and prints an
instruction telling your coding agent to audit each section, re-ground
the weak ones, and rewrite the file in place — leaving strong sections
untouched. Different shape from \`clarify\`: clarify finds gaps and
walks the PM through them; refine takes the existing spec as ground
truth for what the PM wants and improves how it's written and grounded.

When multiple specs of the requested type exist and no <feature-slug>
is supplied, the command errors with the available slugs.
`;

const TYPES = new Set(['product', 'tech', 'tasks']);
const ARG_OPTIONS = {
  type: { type: 'string' },
};

const TYPE_META = {
  product: {
    fileKey: 'productSpec',
    presenceKey: 'hasProductSpec',
    label: 'product spec',
    headingLabel: 'PRODUCT SPEC',
    populateHint: 'draftwise new "<idea>"',
  },
  tech: {
    fileKey: 'technicalSpec',
    presenceKey: 'hasTechnicalSpec',
    label: 'technical spec',
    headingLabel: 'TECHNICAL SPEC',
    populateHint: 'draftwise tech',
  },
  tasks: {
    fileKey: 'tasks',
    presenceKey: 'hasTasks',
    label: 'tasks file',
    headingLabel: 'TASKS',
    populateHint: 'draftwise tasks',
  },
};

export default async function refineCommand(args = [], deps = {}) {
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
    throw new Error(`Invalid arguments to draftwise refine: ${err.message}`, {
      cause: err,
    });
  }
  const requestedSlug = parsed.positionals[0];
  const type = parsed.values.type ?? 'product';
  if (!TYPES.has(type)) {
    throw new Error(
      `Unknown --type "${type}". Expected one of: product, tech, tasks.`,
    );
  }
  const meta = TYPE_META[type];

  const config = await loadConfig(cwd, { log });

  const specs = (await listSpecs(cwd)).filter((s) => s[meta.presenceKey]);
  if (specs.length === 0) {
    throw new Error(
      `No ${meta.label}s found in .draftwise/specs/. Run \`${meta.populateHint}\` first.`,
    );
  }

  let target;
  if (requestedSlug) {
    target = specs.find((s) => s.slug === requestedSlug);
    if (!target) {
      const available = specs.map((s) => s.slug).join(', ');
      throw new Error(
        `No ${meta.label} found for "${requestedSlug}". Available: ${available}`,
      );
    }
  } else if (specs.length === 1) {
    target = specs[0];
    log(`Using the only ${meta.label}: ${target.slug}`);
  } else {
    const available = specs.map((s) => s.slug).join(', ');
    throw new Error(
      `Multiple ${meta.label}s exist. Pass one as a positional argument: draftwise refine <slug>${
        type === 'product' ? '' : ` --type=${type}`
      }. Available: ${available}`,
    );
  }

  const existingSpec = await readFile(target[meta.fileKey], 'utf8');
  if (!existingSpec.trim()) {
    throw new Error(
      `${target.slug}/${target[meta.fileKey].split(/[\\/]/).pop()} is empty. Run \`${meta.populateHint}\` to populate it.`,
    );
  }

  let upstream = null;
  if (type === 'tech') {
    if (!target.hasProductSpec) {
      throw new Error(
        `Cannot refine technical spec for "${target.slug}": product-spec.md is missing. The product spec is the source of truth for the tech spec.`,
      );
    }
    upstream = {
      label: 'PRODUCT SPEC (source of truth)',
      content: await readFile(target.productSpec, 'utf8'),
    };
  } else if (type === 'tasks') {
    if (!target.hasTechnicalSpec) {
      throw new Error(
        `Cannot refine tasks for "${target.slug}": technical-spec.md is missing. The technical spec is the source of truth for tasks.`,
      );
    }
    upstream = {
      label: 'TECHNICAL SPEC (source of truth)',
      content: await readFile(target.technicalSpec, 'utf8'),
    };
  }

  const needsScanContext = type === 'product' || type === 'tech';
  const scanContext = needsScanContext
    ? await loadScanContext({
        cwd,
        config,
        log,
        scan,
        readOverview,
        commandName: 'refine',
      })
    : null;

  log('');
  log(`Handing the ${meta.label} off to your coding agent for refinement.`);
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
  log(`SPEC: ${target.slug}`);
  log(`TYPE: ${type}`);
  log('');
  if (upstream) {
    log(upstream.label);
    log(upstream.content);
    log('');
  }
  log(`EXISTING ${meta.headingLabel} (refine this)`);
  log(existingSpec);
  log('');
  if (scanContext) {
    if (config.projectState === 'greenfield') {
      log('PROJECT PLAN (overview.md)');
      log(scanContext.overview);
    } else {
      log('SCANNER OUTPUT');
      log('```json');
      log(JSON.stringify(scanContext.scanForPrompt, null, 2));
      log('```');
      log('');
      log('PACKAGE METADATA');
      log('```json');
      log(JSON.stringify(scanContext.packageMeta, null, 2));
      log('```');
    }
    log('');
  }
  log('INSTRUCTION');
  log(buildAgentInstruction(target.slug, type, config.projectState));
}
