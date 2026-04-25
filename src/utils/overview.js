import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readOverview(cwd) {
  try {
    return await readFile(join(cwd, '.draftwise', 'overview.md'), 'utf8');
  } catch {
    return '';
  }
}
