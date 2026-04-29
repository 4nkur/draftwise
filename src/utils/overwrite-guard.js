import { confirm } from '@inquirer/prompts';
import { pathExists } from './fs.js';

const DEFAULT_CONFIRM = ({ slug, file }) =>
  confirm({
    message: `${slug}/${file} already exists. Overwrite?`,
    default: false,
  });

// Used by `new` / `tech` / `tasks` before they overwrite a spec file the user
// may have hand-edited.
//
// Returns `true` when the caller should proceed (no existing file, --force
// passed, or the user confirmed). Returns `false` when the user cancelled
// in a TTY. Throws in non-TTY when the file exists and --force wasn't passed
// — scripted callers must opt in explicitly.
//
// The caller decides WHEN to call this:
// - Place it before any expensive synthesis API call so a cancel doesn't burn
//   tokens.
// - Skip it in agent mode (the host coding agent does the write, not
//   Draftwise). The caller checks `config.mode !== 'agent'` itself.

export async function confirmOverwriteOrCancel({
  targetPath,
  slug,
  file,
  force,
  isInteractive,
  log,
  confirmOverwrite = DEFAULT_CONFIRM,
}) {
  if (force) return true;
  if (!(await pathExists(targetPath))) return true;
  if (isInteractive()) {
    const proceed = await confirmOverwrite({ slug, file });
    if (!proceed) {
      log('Cancelled. No changes written. (Pass --force to skip this prompt.)');
      return false;
    }
    return true;
  }
  throw new Error(
    `${slug}/${file} already exists. Pass --force to overwrite.`,
  );
}
