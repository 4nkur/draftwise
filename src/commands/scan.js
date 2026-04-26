import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { pathExists } from '../utils/fs.js';
import { SYSTEM, buildPrompt, AGENT_INSTRUCTION } from '../ai/prompts/scan.js';

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
  const log = deps.log ?? ((msg) => console.log(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error(
      '.draftwise/ not found. Run `draftwise init` first.',
    );
  }

  const config = await loadConfig(cwd);

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

  const scanForPrompt = {
    frameworks: result.frameworks,
    orms: result.orms,
    routes: result.routes,
    components: result.components.slice(0, 50),
    models: result.models,
    fileCount: result.files.length,
    sampleFiles: result.files.slice(0, 30),
  };

  if (config.mode === 'agent') {
    log('Agent mode — handing scanner data off to your coding agent.');
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
    return;
  }

  log(`API mode — calling ${config.provider}...`);
  const overview = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    system: SYSTEM,
    prompt: buildPrompt({ scan: scanForPrompt, packageMeta: result.packageMeta }),
  });

  await writeFile(join(draftwiseDir, 'overview.md'), overview, 'utf8');
  log('');
  log('Wrote .draftwise/overview.md');
}
