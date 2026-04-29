import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { pathExists } from '../utils/fs.js';

export const HELP = `draft list — list all specs in .draftwise/specs/

Usage:
  draft list

Three columns: slug, status (which artifacts exist —
product · tech · tasks), and the title from product-spec.md's H1.
Empty spec dirs show as "(empty)".
`;

async function readTitle(file) {
  try {
    const content = await readFile(file, 'utf8');
    const m = content.match(/^\s*#\s+(.+)$/m);
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

function buildStatus(spec) {
  const parts = [];
  if (spec.hasProductSpec) parts.push('product');
  if (spec.hasTechnicalSpec) parts.push('tech');
  if (spec.hasTasks) parts.push('tasks');
  return parts.join(' · ') || '(empty)';
}

function pad(s, n) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

export default async function listCommand(_args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  // The table IS the output of `list` — keep it on stdout so piping works
  // (`draft list > specs.txt`).
  const log = deps.log ?? ((msg) => console.log(msg));
  const listSpecs = deps.listSpecs ?? defaultListSpecs;

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draft init` first.');
  }

  const specs = await listSpecs(cwd);
  if (specs.length === 0) {
    log('No specs yet. Run `draft new "<idea>"` to draft one.');
    return;
  }

  const rows = await Promise.all(
    specs.map(async (s) => ({
      slug: s.slug,
      status: buildStatus(s),
      title: s.hasProductSpec ? await readTitle(s.productSpec) : '',
    })),
  );

  const slugWidth = Math.max(4, ...rows.map((r) => r.slug.length));
  const statusWidth = Math.max(6, ...rows.map((r) => r.status.length));

  log(`${rows.length} spec${rows.length === 1 ? '' : 's'} in .draftwise/specs/`);
  log('');
  log(`${pad('SLUG', slugWidth)}  ${pad('STATUS', statusWidth)}  TITLE`);
  log(
    `${'-'.repeat(slugWidth)}  ${'-'.repeat(statusWidth)}  ${'-'.repeat(20)}`,
  );
  for (const r of rows) {
    log(`${pad(r.slug, slugWidth)}  ${pad(r.status, statusWidth)}  ${r.title}`);
  }
}
