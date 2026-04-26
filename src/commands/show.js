import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listSpecs as defaultListSpecs } from '../utils/specs.js';
import { pathExists } from '../utils/fs.js';

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
  const log = deps.log ?? ((msg) => console.log(msg));
  const listSpecs = deps.listSpecs ?? defaultListSpecs;

  const slug = args[0];
  const type = args[1] ?? 'product';

  if (!slug) {
    throw new Error(
      'Usage: draftwise show <feature> [product|tech|tasks]  (default type: product)',
    );
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      `Invalid spec type "${type}". Must be one of: ${VALID_TYPES.join(', ')}.`,
    );
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
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
      `${TYPE_TO_FILENAME[type]} not found for "${slug}". Run \`draftwise ${type === 'product' ? 'new' : type}\` to generate it.`,
    );
  }

  const content = await readFile(filePath, 'utf8');
  log(content);
}
