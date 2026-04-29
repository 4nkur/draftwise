import { join } from 'node:path';
import { pathExists } from './fs.js';

// Most commands run only inside a project that has `draftwise init`-d. This
// helper returns the resolved `.draftwise/` path or throws the same friendly
// "run init first" hint everywhere, so the eight callers don't repeat the
// guard.
//
// `init.js` is the exception — it asserts the directory does NOT exist and
// has its own bespoke error. It doesn't go through this helper.
export async function requireDraftwiseDir(cwd) {
  const dir = join(cwd, '.draftwise');
  if (!(await pathExists(dir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }
  return dir;
}
