import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { filterScanForFlow } from '../utils/flow-filter.js';
import { pathExists } from '../utils/fs.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { compactScan } from '../utils/scan-projection.js';
import { SYSTEM, buildPrompt, buildAgentInstruction } from '../ai/prompts/explain.js';
import { slugify } from '../utils/slug.js';

export const HELP = `draft explain <flow> — trace a flow through the codebase

Usage:
  draft explain "<flow name>"
  draft explain checkout
  draft explain "user signup"

Walks the flow end-to-end: entry points, services, data writes,
side effects, edge cases the code handles. The scan is filtered
to flow-keyword-relevant files so the model focuses on what
matters. Saves a snapshot to .draftwise/flows/<slug>.md in api
mode. Brownfield only — greenfield short-circuits with a hint.
`;

export default async function explainCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;

  const flow = args.join(' ').trim();
  if (!flow) {
    throw new Error(
      'Missing flow name. Usage: draft explain "<flow name>"  (e.g. draft explain checkout)',
    );
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draft init` first.');
  }

  const config = await loadConfig(cwd);

  if (config.projectState === 'greenfield') {
    log(`No code yet — \`draft explain\` traces flows that exist in the codebase.`);
    log(
      'Once you have implemented this flow, come back and run `draft explain <flow>`.',
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
      `No source files found under ${cwd}. Run \`draft explain\` from your repo root.`,
    );
  }

  const compact = compactScan(result);
  const scanForPrompt = filterScanForFlow(compact, flow);

  if (config.mode === 'agent') {
    log('');
    log('Agent mode — handing scanner data off to your coding agent.');
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
    return;
  }

  log(`API mode — calling ${config.provider}...`);
  log('');
  const walkthrough = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    maxTokens: config.maxTokens,
    system: SYSTEM,
    prompt: buildPrompt({
      flow,
      scan: scanForPrompt,
      packageMeta: result.packageMeta,
    }),
    onToken: (chunk) => process.stdout.write(chunk),
  });
  log('');

  const flowsDir = join(draftwiseDir, 'flows');
  await mkdir(flowsDir, { recursive: true });
  const outPath = join(flowsDir, `${slug}.md`);
  await writeFile(outPath, walkthrough, 'utf8');
  log(`Saved snapshot to .draftwise/flows/${slug}.md`);
}
