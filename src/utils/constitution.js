import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONSTITUTION_PATH_PARTS = ['.draftwise', 'constitution.md'];

export const CONSTITUTION_RELATIVE_PATH = CONSTITUTION_PATH_PARTS.join('/');

export async function readConstitution(cwd = process.cwd()) {
  const path = join(cwd, ...CONSTITUTION_PATH_PARTS);
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}
