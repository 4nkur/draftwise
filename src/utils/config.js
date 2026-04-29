import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const VALID_PROJECT_STATES = new Set(['greenfield', 'brownfield']);

export async function loadConfig(cwd = process.cwd(), { log } = {}) {
  const path = join(cwd, '.draftwise', 'config.yaml');
  try {
    await access(path);
  } catch {
    throw new Error(
      '.draftwise/config.yaml not found. Run `draftwise init` first.',
    );
  }

  const raw = await readFile(path, 'utf8');
  let parsed;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(`Failed to parse .draftwise/config.yaml: ${err.message}`, {
      cause: err,
    });
  }

  // Configs written before api-mode was dropped still carry an `ai:` block.
  // Surface a one-line notice so the user knows it's safe to delete; don't
  // error — leaving it in place keeps old configs working.
  if (parsed?.ai && typeof log === 'function') {
    log(
      'Note: the `ai:` block in .draftwise/config.yaml is no longer used (Draftwise now runs only inside coding agents). You can delete it.',
    );
  }

  const project = parsed?.project ?? {};
  const projectState = VALID_PROJECT_STATES.has(project.state)
    ? project.state
    : 'brownfield';

  const scan = parsed?.scan ?? {};
  let scanMaxFiles;
  if (typeof scan.max_files === 'number' && Number.isFinite(scan.max_files)) {
    scanMaxFiles = Math.max(1, Math.floor(scan.max_files));
  }

  return {
    projectState,
    stack: project.stack,
    scanMaxFiles,
  };
}
