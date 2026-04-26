import { access } from 'node:fs/promises';

// Returns true when a path exists and is reachable, false otherwise.
// Swallows errors deliberately — used for cheap existence checks where
// the caller treats "couldn't stat" the same as "doesn't exist".
export async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
