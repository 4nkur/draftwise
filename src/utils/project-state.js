import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { CODE_EXTENSIONS, IGNORE_DIRS } from '../core/scanner.js';

// Returns 'greenfield' (no source files anywhere) or 'brownfield' (at least
// one). Bails on the first source file found — no need to enumerate the rest.
// Hidden directories (`.git`, `.github`, `.vscode`, etc.) and IGNORE_DIRS are
// skipped: they don't represent the project's source code, and walking them
// just slows the check down.
export async function detectProjectState(cwd) {
  const found = await hasSourceFile(cwd);
  return found ? 'brownfield' : 'greenfield';
}

async function hasSourceFile(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (CODE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      return true;
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    if (await hasSourceFile(join(dir, entry.name))) return true;
  }

  return false;
}
