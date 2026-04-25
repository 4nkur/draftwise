import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.draftwise',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.cache',
  '.vite',
  '.parcel-cache',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.tsx', '.mts', '.cts',
  '.vue', '.svelte',
  '.py',
  '.go',
  '.rs',
  '.rb',
  '.java', '.kt', '.kts',
  '.swift',
  '.php',
  '.cs',
  '.c', '.cc', '.cpp', '.h', '.hpp',
]);

export async function scan(root) {
  const files = [];
  await walk(root, root, files);
  return { root, files };
}

async function walk(root, dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0) continue;
      if (CODE_EXTENSIONS.has(entry.name.slice(dot).toLowerCase())) {
        out.push(relative(root, full).split('\\').join('/'));
      }
    }
  }
}
