import { parseArgs } from 'node:util';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { buildAgentInstruction } from '../ai/prompts/new.js';

export const HELP = `draftwise new "<idea>" — conversational product-spec drafting

Usage:
  draftwise new "<your feature idea>"
  draftwise new "add collaborative albums"

Prints scanner data (brownfield) or the project plan (greenfield)
plus a three-phase instruction for your coding agent: plan a
conversation, walk the PM through clarifying questions, then write
product-spec.md to .draftwise/specs/<slug>/.

Hard rule: every claim grounds in scanner output (brownfield) or
the project plan (greenfield). Never invents files.
`;

const ARG_OPTIONS = {};

export default async function newCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const readOverview = deps.readOverview ?? defaultReadOverview;

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: ARG_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    throw new Error(`Invalid arguments to draftwise new: ${err.message}`, {
      cause: err,
    });
  }
  const idea = parsed.positionals.join(' ').trim();
  if (!idea) {
    throw new Error('Missing idea. Usage: draftwise new "<your feature idea>"');
  }

  await requireDraftwiseDir(cwd);

  const config = await loadConfig(cwd, { log });
  const isGreenfield = config.projectState === 'greenfield';

  log(`Idea: "${idea}"`);

  const { scanForPrompt, packageMeta, overview } = await loadScanContext({
    cwd,
    config,
    log,
    scan,
    readOverview,
    commandName: 'new',
  });

  log('');
  if (isGreenfield) {
    log(
      'Handing the project plan + conversation off to your coding agent.',
    );
  } else {
    log(
      'Handing scanner data + the conversation plan off to your coding agent.',
    );
  }
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
  log(`IDEA: ${idea}`);
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
  log(buildAgentInstruction(idea, config.projectState));
}
