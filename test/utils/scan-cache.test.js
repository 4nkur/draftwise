import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  utimes,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedScan } from '../../src/utils/scan-cache.js';

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function seedRepo(dir) {
  await writeFile(join(dir, 'package.json'), '{"name":"demo"}', 'utf8');
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'src', 'a.js'), '// a', 'utf8');
  await writeFile(join(dir, 'src', 'b.js'), '// b', 'utf8');
}

describe('cachedScan', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-cache-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('runs the scan on first call and writes the cache file', async () => {
    await seedRepo(dir);
    const calls = [];
    const fakeScan = async (root, opts) => {
      calls.push({ root, opts });
      return { files: ['src/a.js', 'src/b.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {} };
    };

    const result = await cachedScan(dir, { scan: fakeScan });
    expect(calls).toHaveLength(1);
    expect(result.fromCache).toBe(false);
    expect(result.files).toEqual(['src/a.js', 'src/b.js']);
    expect(await pathExists(join(dir, '.draftwise', '.cache', 'scan.json'))).toBe(
      true,
    );
  });

  it('returns the cache on second call when nothing changed', async () => {
    await seedRepo(dir);
    let calls = 0;
    const fakeScan = async () => {
      calls++;
      return { files: ['src/a.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {} };
    };

    const first = await cachedScan(dir, { scan: fakeScan });
    expect(first.fromCache).toBe(false);

    const second = await cachedScan(dir, { scan: fakeScan });
    expect(second.fromCache).toBe(true);
    expect(calls).toBe(1);
  });

  it('invalidates the cache when a source file is touched', async () => {
    await seedRepo(dir);
    let calls = 0;
    const fakeScan = async () => {
      calls++;
      return { files: ['src/a.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {} };
    };

    await cachedScan(dir, { scan: fakeScan });
    expect(calls).toBe(1);

    // Touch a file's mtime forward.
    const future = new Date(Date.now() + 60_000);
    await utimes(join(dir, 'src', 'a.js'), future, future);

    await cachedScan(dir, { scan: fakeScan });
    expect(calls).toBe(2);
  });

  it('invalidates when maxFiles changes (config knob bumped)', async () => {
    await seedRepo(dir);
    let calls = 0;
    const fakeScan = async (root, opts) => {
      calls++;
      return { files: ['src/a.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {}, maxFiles: opts.maxFiles };
    };

    await cachedScan(dir, { scan: fakeScan, maxFiles: 100 });
    await cachedScan(dir, { scan: fakeScan, maxFiles: 100 });
    expect(calls).toBe(1);

    await cachedScan(dir, { scan: fakeScan, maxFiles: 200 });
    expect(calls).toBe(2);
  });

  it('useCache: false bypasses the cache entirely', async () => {
    await seedRepo(dir);
    let calls = 0;
    const fakeScan = async () => {
      calls++;
      return { files: ['src/a.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {} };
    };

    await cachedScan(dir, { scan: fakeScan });
    await cachedScan(dir, { scan: fakeScan, useCache: false });
    await cachedScan(dir, { scan: fakeScan, useCache: false });
    expect(calls).toBe(3);
  });

  it('survives a corrupt cache file by re-scanning', async () => {
    await seedRepo(dir);
    await mkdir(join(dir, '.draftwise', '.cache'), { recursive: true });
    await writeFile(
      join(dir, '.draftwise', '.cache', 'scan.json'),
      '{not valid json',
      'utf8',
    );

    let calls = 0;
    const fakeScan = async () => {
      calls++;
      return { files: ['src/a.js'], frameworks: [], routes: [], components: [], models: [], packageMeta: {} };
    };

    const result = await cachedScan(dir, { scan: fakeScan });
    expect(calls).toBe(1);
    expect(result.fromCache).toBe(false);
    // And the corrupt file got replaced with a valid one.
    const fresh = await readFile(
      join(dir, '.draftwise', '.cache', 'scan.json'),
      'utf8',
    );
    expect(JSON.parse(fresh).fingerprint).toBeTypeOf('string');
  });
});
