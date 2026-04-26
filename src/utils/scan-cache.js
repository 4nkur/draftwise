import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import {
  scan as defaultScan,
  IGNORE_DIRS,
  CODE_EXTENSIONS,
  DEFAULT_MAX_FILES,
} from '../core/scanner.js';

const CACHE_REL_PATH = ['.draftwise', '.cache', 'scan.json'];

// Bump this when the scan result shape changes (new field, renamed key,
// removed field). Old cache entries with a different version are
// treated as cache-miss instead of returning stale-shape data.
const CACHE_VERSION = 1;

function cachePath(root) {
  return join(root, ...CACHE_REL_PATH);
}

export async function cachedScan(root, options = {}) {
  const useCache = options.useCache !== false;
  const scan = options.scan ?? defaultScan;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  if (!useCache) {
    return scan(root, { maxFiles });
  }

  const fingerprint = await computeFingerprint(root, maxFiles);
  const path = cachePath(root);
  const cached = await readCache(path);

  if (
    cached &&
    cached.cacheVersion === CACHE_VERSION &&
    cached.fingerprint === fingerprint
  ) {
    return { ...cached.result, fromCache: true };
  }

  const fresh = await scan(root, { maxFiles });
  await writeCache(path, {
    cacheVersion: CACHE_VERSION,
    fingerprint,
    savedAt: new Date().toISOString(),
    result: fresh,
  });
  return { ...fresh, fromCache: false };
}

async function readCache(path) {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.fingerprint === 'string' &&
      parsed.result &&
      typeof parsed.result === 'object'
    ) {
      return parsed;
    }
  } catch {
    // Missing or unparseable — treat as no cache.
  }
  return null;
}

async function writeCache(path, payload) {
  try {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(payload), 'utf8');
  } catch {
    // Cache writes are best-effort; swallow errors so they don't fail the command.
  }
}

async function computeFingerprint(root, maxFiles) {
  const entries = [];
  const state = { count: 0, max: maxFiles, truncated: false };
  await walkForFingerprint(root, root, entries, state);
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = createHash('sha256');
  hash.update(`maxFiles:${maxFiles}\n`);
  for (const e of entries) hash.update(`${e.path}\t${e.mtimeMs}\n`);
  return hash.digest('hex');
}

async function walkForFingerprint(root, dir, out, state) {
  if (state.truncated) return;
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of dirents) {
    if (state.truncated) return;
    if (IGNORE_DIRS.has(ent.name)) continue;
    if (ent.name.startsWith('.')) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkForFingerprint(root, full, out, state);
    } else if (ent.isFile()) {
      if (!CODE_EXTENSIONS.has(extOf(ent.name))) continue;
      if (state.count >= state.max) {
        state.truncated = true;
        return;
      }
      let st;
      try {
        st = await stat(full);
      } catch {
        continue;
      }
      out.push({
        path: relative(root, full).split(sep).join('/'),
        mtimeMs: Math.floor(st.mtimeMs),
      });
      state.count++;
    }
  }
}

function extOf(name) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}
