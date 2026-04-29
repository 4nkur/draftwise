import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { compactScan } from '../utils/scan-projection.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { AGENT_INSTRUCTION } from '../ai/prompts/scan.js';

export const HELP = `draftwise scan — refresh the codebase overview (brownfield)

Usage:
  draftwise scan

Re-runs the scanner and prints the structured data plus an
instruction for your coding agent, which writes the narrated
overview to .draftwise/overview.md. In a greenfield project,
prints a friendly hint and exits — the plan from
\`draftwise init\` is already in overview.md.
`;

function summarize(scan) {
  return {
    files: scan.files.length,
    frameworks: scan.frameworks,
    orms: scan.orms,
    routes: scan.routes.length,
    components: scan.components.length,
    models: scan.models.length,
  };
}

export default async function scanCommand(_args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;

  await requireDraftwiseDir(cwd);

  const config = await loadConfig(cwd, { log });

  if (config.projectState === 'greenfield') {
    log('No code yet — `draftwise scan` works on existing codebases.');
    log(
      'Once you have some code on disk, run scan to refresh .draftwise/overview.md from the actual code.',
    );
    log('');
    log('In the meantime, the greenfield plan is in .draftwise/overview.md and');
    log('`draftwise new "<feature idea>"` is the next step toward a spec.');
    return;
  }

  log('Scanning repo...');
  const result = await scan(cwd, { maxFiles: config.scanMaxFiles });

  if (!result.files || result.files.length === 0) {
    throw new Error(
      `No source files found under ${cwd}. Run \`draftwise scan\` from your repo root.`,
    );
  }

  const summary = summarize(result);
  log(
    `  ${summary.files} files · ${summary.frameworks.join(', ') || 'no framework detected'} · ${summary.routes} routes · ${summary.components} components · ${summary.models} models`,
  );
  for (const warning of describeScanWarnings(result, {
    includeFrameworkHint: true,
  })) {
    log(warning);
  }
  log('');

  const scanForPrompt = compactScan(result);

  log('Handing scanner data off to your coding agent.');
  log(AGENT_HANDOFF_PREFIX);
  log('');
  log('---');
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
  log(AGENT_INSTRUCTION);
}
