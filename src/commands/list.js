import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { readFrontmatter, asSlugList } from '../utils/frontmatter.js';

export const HELP = `draftwise list — list all specs in .draftwise/specs/

Usage:
  draftwise list

Four columns: slug, status (which artifacts exist —
product · tech · tasks), depends_on (from the product-spec.md
frontmatter), and the title from product-spec.md's H1.
Empty spec dirs show as "(empty)".
`;

function extractTitle(body) {
  const m = body.match(/^\s*#\s+(.+)$/m);
  return m ? m[1].trim() : '';
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
  // (`draftwise list > specs.txt`).
  const log = deps.log ?? ((msg) => console.log(msg));
  const listSpecs = deps.listSpecs ?? defaultListSpecs;

  await requireDraftwiseDir(cwd);

  const specs = await listSpecs(cwd);
  if (specs.length === 0) {
    log('No specs yet. Run `draftwise new "<idea>"` to draft one.');
    return;
  }

  const rows = await Promise.all(
    specs.map(async (s) => {
      if (!s.hasProductSpec) {
        return { slug: s.slug, status: buildStatus(s), dependsOn: '', title: '' };
      }
      const { data, body } = await readFrontmatter(s.productSpec);
      return {
        slug: s.slug,
        status: buildStatus(s),
        dependsOn: asSlugList(data.depends_on).join(', '),
        title: extractTitle(body),
      };
    }),
  );

  const slugWidth = Math.max(4, ...rows.map((r) => r.slug.length));
  const statusWidth = Math.max(6, ...rows.map((r) => r.status.length));
  const dependsWidth = Math.max(10, ...rows.map((r) => r.dependsOn.length));

  log(`${rows.length} spec${rows.length === 1 ? '' : 's'} in .draftwise/specs/`);
  log('');
  log(
    `${pad('SLUG', slugWidth)}  ${pad('STATUS', statusWidth)}  ${pad('DEPENDS ON', dependsWidth)}  TITLE`,
  );
  log(
    `${'-'.repeat(slugWidth)}  ${'-'.repeat(statusWidth)}  ${'-'.repeat(dependsWidth)}  ${'-'.repeat(20)}`,
  );
  for (const r of rows) {
    log(
      `${pad(r.slug, slugWidth)}  ${pad(r.status, statusWidth)}  ${pad(r.dependsOn, dependsWidth)}  ${r.title}`,
    );
  }
}
