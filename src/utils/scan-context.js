import { describeScanWarnings } from './scan-warnings.js';
import { compactScan } from './scan-projection.js';

// Loads the scan / overview context that `new`, `tech`, and `tasks` all need
// before drafting their respective specs. Two paths:
//
// - **Greenfield** — read `.draftwise/overview.md` (the project plan written
//   by `init`). The scan-shaped fields come back as `null` because there's no
//   code to scan yet.
// - **Brownfield** — run the cached scan, surface any warnings, and return
//   the prompt-sized projection plus package metadata. `overview` is
//   `undefined` here.
//
// `commandName` flows into the brownfield "no source files" error so each
// caller's hint says "Run `draftwise <name>` from your repo root."

export async function loadScanContext({
  cwd,
  config,
  log,
  scan,
  readOverview,
  commandName,
}) {
  if (config.projectState === 'greenfield') {
    log('Reading project plan from overview.md...');
    const overview = await readOverview(cwd);
    if (!overview.trim()) {
      throw new Error(
        'Greenfield project but .draftwise/overview.md is missing or empty. Re-run `draftwise init` to generate the plan, or switch the config to brownfield once code exists.',
      );
    }
    return { scanForPrompt: null, packageMeta: null, overview };
  }

  log('Scanning repo...');
  const result = await scan(cwd, { maxFiles: config.scanMaxFiles });
  if (!result.files || result.files.length === 0) {
    throw new Error(
      `No source files found under ${cwd}. Run \`draftwise ${commandName}\` from your repo root.`,
    );
  }
  for (const warning of describeScanWarnings(result)) {
    log(warning);
  }
  return {
    scanForPrompt: compactScan(result),
    packageMeta: result.packageMeta,
    overview: undefined,
  };
}
