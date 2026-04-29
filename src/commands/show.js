import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { pathExists } from '../utils/fs.js';

export const HELP = `draft show <feature> [type] — print a spec to terminal

Usage:
  draft show <feature>             # default type: product
  draft show <feature> tech
  draft show <feature> tasks

Type must be one of: product, tech, tasks. Errors with a hint if
the requested type hasn't been generated yet (e.g., asking for
tech before \`draft tech\` has run).
`;

const VALID_TYPES = ['product', 'tech', 'tasks'];

const TYPE_TO_FILE = {
  product: 'productSpec',
  tech: 'technicalSpec',
  tasks: 'tasks',
};

const TYPE_TO_FILENAME = {
  product: 'product-spec.md',
  tech: 'technical-spec.md',
  tasks: 'tasks.md',
};

export default async function showCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  // Spec content IS the output of `show` — keep it on stdout so piping works
  // (`draft show <feature> > spec.md`).
  const log = deps.log ?? ((msg) => console.log(msg));
  const listSpecs = deps.listSpecs ?? defaultListSpecs;

  const slug = args[0];
  const type = args[1] ?? 'product';

  if (!slug) {
    throw new Error(
      'Missing feature name. Usage: draft show <feature> [product|tech|tasks]  (default type: product)',
    );
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      `Invalid spec type "${type}". Must be one of: ${VALID_TYPES.join(', ')}.`,
    );
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draft init` first.');
  }

  const specs = await listSpecs(cwd);
  const target = specs.find((s) => s.slug === slug);
  if (!target) {
    const available = specs.map((s) => s.slug).join(', ') || '(none yet)';
    throw new Error(
      `No spec found for "${slug}". Available: ${available}`,
    );
  }

  const filePath = target[TYPE_TO_FILE[type]];
  if (!(await pathExists(filePath))) {
    throw new Error(
      `${TYPE_TO_FILENAME[type]} not found for "${slug}". Run \`draft ${type === 'product' ? 'new' : type}\` to generate it.`,
    );
  }

  const content = await readFile(filePath, 'utf8');
  log(content);
}
