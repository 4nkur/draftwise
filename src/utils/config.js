import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const VALID_MODES = new Set(['agent', 'api']);
const VALID_PROVIDERS = new Set(['claude', 'openai', 'gemini']);
const VALID_PROJECT_STATES = new Set(['greenfield', 'brownfield']);

export async function loadConfig(cwd = process.cwd()) {
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
    throw new Error(`Failed to parse .draftwise/config.yaml: ${err.message}`);
  }

  const ai = parsed?.ai;
  if (!ai || !VALID_MODES.has(ai.mode)) {
    throw new Error(
      '.draftwise/config.yaml is missing a valid `ai.mode` (agent or api).',
    );
  }

  if (ai.mode === 'api') {
    if (!VALID_PROVIDERS.has(ai.provider)) {
      throw new Error(
        '.draftwise/config.yaml has `ai.mode: api` but is missing a valid `ai.provider` (claude, openai, or gemini).',
      );
    }
    if (!ai.api_key_env || typeof ai.api_key_env !== 'string') {
      throw new Error(
        '.draftwise/config.yaml has `ai.mode: api` but is missing `ai.api_key_env`.',
      );
    }
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
    mode: ai.mode,
    provider: ai.provider,
    apiKeyEnv: ai.api_key_env,
    model: ai.model || '',
    projectState,
    stack: project.stack,
    scanMaxFiles,
  };
}
