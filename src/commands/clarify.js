import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { buildAgentInstruction } from '../ai/prompts/clarify.js';

export const HELP = `draftwise clarify [<feature>] — surface gaps in an existing product spec

Usage:
  draftwise clarify                 # auto-pick if exactly one product spec exists
  draftwise clarify <feature-slug>  # target a specific feature

Reads the product spec and prints an instruction for your coding agent
to audit it for ambiguities, untested assumptions, internal
contradictions, and missing edge cases — then walk the PM through each
one and rewrite the spec in place.

When multiple product specs exist and no <feature-slug> is supplied,
the command errors with the available slugs.
`;

const ARG_OPTIONS = {};

export default async function clarifyCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const listSpecs = deps.listSpecs ?? defaultListSpecs;

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
    throw new Error(`Invalid arguments to draftwise clarify: ${err.message}`, {
      cause: err,
    });
  }
  const requestedSlug = parsed.positionals[0];

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
      `Multiple product specs exist. Pass one as a positional argument: draftwise clarify <slug>. Available: ${available}`,
    );
  }

  const productSpec = await readFile(target.productSpec, 'utf8');
  if (!productSpec.trim()) {
    throw new Error(
      `${target.slug}/product-spec.md is empty. Run \`draftwise new\` to populate it.`,
    );
  }

  log('');
  log('Handing the product spec off to your coding agent for clarification.');
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
  log(`SPEC: ${target.slug}`);
  log('');
  log('PRODUCT SPEC');
  log(productSpec);
  log('');
  log('INSTRUCTION');
  log(buildAgentInstruction(target.slug));
}
