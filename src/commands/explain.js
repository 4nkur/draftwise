import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { filterScanForFlow } from '../utils/flow-filter.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { compactScan } from '../utils/scan-projection.js';
import { buildAgentInstruction } from '../ai/prompts/explain.js';
import { slugify } from '../utils/slug.js';

export const HELP = `draftwise explain <flow> — trace a flow through the codebase

Usage:
  draftwise explain "<flow name>"
  draftwise explain checkout
  draftwise explain "user signup"

Walks the flow end-to-end: entry points, services, data writes,
side effects, edge cases the code handles. The scan is filtered
to flow-keyword-relevant files so the model focuses on what
matters. Prints scanner data plus an instruction for your coding
agent, which writes the walkthrough to .draftwise/flows/<slug>.md.
Brownfield only — greenfield short-circuits with a hint.
`;

export default async function explainCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;

  const flow = args.join(' ').trim();
  if (!flow) {
    throw new Error(
      'Missing flow name. Usage: draftwise explain "<flow name>"  (e.g. draftwise explain checkout)',
    );
  }

  await requireDraftwiseDir(cwd);

  const config = await loadConfig(cwd, { log });

  if (config.projectState === 'greenfield') {
    log(`No code yet — \`draftwise explain\` traces flows that exist in the codebase.`);
    log(
      'Once you have implemented this flow, come back and run `draftwise explain <flow>`.',
    );
    return;
  }

  const slug = slugify(flow);

  log(`Tracing "${flow}"...`);
  const result = await scan(cwd, { maxFiles: config.scanMaxFiles });
  for (const warning of describeScanWarnings(result)) {
    log(warning);
  }

  if (!result.files || result.files.length === 0) {
    throw new Error(
      `No source files found under ${cwd}. Run \`draftwise explain\` from your repo root.`,
    );
  }

  const compact = compactScan(result);
  const scanForPrompt = filterScanForFlow(compact, flow);

  log('');
  log('Handing scanner data off to your coding agent.');
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
  log(`FLOW: ${flow}`);
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
  log(buildAgentInstruction(flow, slug));
}
