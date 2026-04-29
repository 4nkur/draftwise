import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pathExists } from '../utils/fs.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';

export const HELP = `draftwise scaffold --yes — create initial files from a greenfield plan

Usage:
  draftwise scaffold --yes        # confirm and write the files

Flags:
  --yes, -y                   # Required. Confirms you want files created.

Reads .draftwise/scaffold.json (written by your coding agent during
greenfield init's handoff) and creates each initial_files entry with
placeholder content. Skips files that already exist. Refuses paths
that escape the project root. Does NOT run setup commands — they're
printed for manual execution.

--yes is required so this never writes files without explicit
confirmation. If your setup commands include a project scaffolder
(e.g. create-next-app, create-vite), run those FIRST — scaffold
won't overwrite existing files but it may interfere with a fresh
scaffolder run.
`;

const ARG_OPTIONS = {
  yes: { type: 'boolean', short: 'y' },
};

function placeholderFor(path, purpose) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  const note = purpose ? ` ${purpose}` : '';
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return `// TODO:${note}\n`;
    case '.py':
      return `# TODO:${note}\n`;
    case '.md':
      return `# ${purpose || path}\n\n_TODO_\n`;
    case '.json':
      return '{}\n';
    case '.yml':
    case '.yaml':
      return purpose ? `# ${purpose}\n` : '';
    case '.html':
      return '<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body></body>\n</html>\n';
    case '.css':
    case '.scss':
      return purpose ? `/* ${purpose} */\n` : '';
    default:
      return '';
  }
}

export default async function scaffoldCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: ARG_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    throw new Error(`Invalid arguments to draftwise scaffold: ${err.message}`, {
      cause: err,
    });
  }
  const confirmed = Boolean(parsed.values.yes);

  const draftwiseDir = await requireDraftwiseDir(cwd);

  // Short-circuit for brownfield projects — scaffold has nothing to do, and
  // the missing-scaffold.json error message would mislead the user toward
  // an "ask your agent" path that doesn't apply.
  const config = await loadConfig(cwd, { log });
  if (config.projectState === 'brownfield') {
    log(
      'scaffold is greenfield-only — your project is brownfield, so there are no initial files to create.',
    );
    return;
  }

  if (!confirmed) {
    throw new Error(
      'draftwise scaffold needs --yes to confirm before writing files. Run again with --yes once you are ready (and after running any project scaffolder like create-next-app first).',
    );
  }

  const scaffoldPath = join(draftwiseDir, 'scaffold.json');
  if (!(await pathExists(scaffoldPath))) {
    throw new Error(
      '.draftwise/scaffold.json not found. Greenfield init\'s handoff tells your coding agent to write this from the stack-selection conversation; if it\'s missing, ask your agent to write it (or write it manually).',
    );
  }

  let plan;
  try {
    const raw = await readFile(scaffoldPath, 'utf8');
    plan = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse .draftwise/scaffold.json: ${err.message}`,
      { cause: err },
    );
  }

  const initialFiles = Array.isArray(plan.initial_files) ? plan.initial_files : [];
  if (initialFiles.length === 0) {
    log('scaffold.json has no initial_files to create. Nothing to do.');
    return;
  }

  log(`Stack: ${plan.stack ?? '(unknown)'}`);
  if (plan.summary) log(plan.summary);
  log('');
  log(`Initial files to create (${initialFiles.length}):`);
  for (const f of initialFiles) {
    log(`  • ${f.path}${f.purpose ? `  — ${f.purpose}` : ''}`);
  }
  log('');

  let created = 0;
  let skipped = 0;
  let blocked = 0;
  const cwdResolved = resolve(cwd);
  for (const f of initialFiles) {
    if (!f.path || typeof f.path !== 'string') continue;
    const fullPath = resolve(cwd, f.path);
    // Guard: a malicious or careless plan could specify "../../etc/passwd".
    // Refuse anything that resolves outside the project root.
    if (
      fullPath !== cwdResolved &&
      !fullPath.startsWith(cwdResolved + sep)
    ) {
      log(`  ! blocked (escapes project root): ${f.path}`);
      blocked++;
      continue;
    }
    if (await pathExists(fullPath)) {
      log(`  ~ skipped (exists): ${f.path}`);
      skipped++;
      continue;
    }
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, placeholderFor(f.path, f.purpose), 'utf8');
    log(`  + created: ${f.path}`);
    created++;
  }

  log('');
  log(
    `Done — ${created} created, ${skipped} skipped${blocked > 0 ? `, ${blocked} blocked` : ''}.`,
  );

  const setupCommands = Array.isArray(plan.setup_commands)
    ? plan.setup_commands
    : [];
  if (setupCommands.length > 0) {
    log('');
    log('Setup commands (run these manually if you haven\'t already):');
    for (const cmd of setupCommands) log(`  $ ${cmd}`);
  }
}
