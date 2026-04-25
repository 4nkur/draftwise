import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { filterScanForFlow } from '../utils/flow-filter.js';
import { SYSTEM, buildPrompt, buildAgentInstruction } from '../ai/prompts/explain.js';
import { slugify } from '../utils/slug.js';

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

export default async function explainCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.log(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;

  const flow = args.join(' ').trim();
  if (!flow) {
    throw new Error(
      'Missing flow name. Usage: draftwise explain "<flow name>"  (e.g. draftwise explain checkout)',
    );
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }

  const config = await loadConfig(cwd);

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

  if (config.mode === 'agent') {
    log('');
    log('Agent mode — handing scanner data off to your coding agent.');
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
  const walkthrough = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    system: SYSTEM,
    prompt: buildPrompt({
      flow,
      scan: scanForPrompt,
      packageMeta: result.packageMeta,
    }),
  });

  log('');
  log(walkthrough);
  log('');

  const flowsDir = join(draftwiseDir, 'flows');
  await mkdir(flowsDir, { recursive: true });
  const outPath = join(flowsDir, `${slug}.md`);
  await writeFile(outPath, walkthrough, 'utf8');
  log(`Saved snapshot to .draftwise/flows/${slug}.md`);
}
