import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from './fs.js';

export async function listSpecs(cwd) {
  const specsDir = join(cwd, '.draftwise', 'specs');
  let entries;
  try {
    entries = await readdir(specsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(specsDir, entry.name);
    const productSpec = join(dir, 'product-spec.md');
    const technicalSpec = join(dir, 'technical-spec.md');
    const tasks = join(dir, 'tasks.md');
    out.push({
      slug: entry.name,
      dir,
      productSpec,
      technicalSpec,
      tasks,
      hasProductSpec: await pathExists(productSpec),
      hasTechnicalSpec: await pathExists(technicalSpec),
      hasTasks: await pathExists(tasks),
    });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}
