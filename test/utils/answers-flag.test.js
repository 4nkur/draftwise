import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAnswersFlag } from '../../src/utils/answers-flag.js';

describe('loadAnswersFlag', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-answers-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null when value is undefined', async () => {
    expect(await loadAnswersFlag(undefined)).toBeNull();
  });

  it('returns null when value is empty string', async () => {
    expect(await loadAnswersFlag('')).toBeNull();
  });

  it('parses an inline JSON array of strings', async () => {
    expect(await loadAnswersFlag('["one", "two"]')).toEqual(['one', 'two']);
  });

  it('reads and parses a JSON file referenced via @path', async () => {
    const path = join(dir, 'answers.json');
    await writeFile(path, '["a", "b", "c"]', 'utf8');
    expect(await loadAnswersFlag(`@${path}`)).toEqual(['a', 'b', 'c']);
  });

  it('throws with the missing path when @file does not exist', async () => {
    const path = join(dir, 'nope.json');
    await expect(loadAnswersFlag(`@${path}`)).rejects.toThrow(
      /Could not read --answers file/,
    );
  });

  it('throws when JSON is malformed', async () => {
    await expect(loadAnswersFlag('not-json')).rejects.toThrow(
      /--answers must be a JSON array/,
    );
  });

  it('throws when JSON is not an array', async () => {
    await expect(loadAnswersFlag('{"a":1}')).rejects.toThrow(
      /--answers must be a JSON array of strings/,
    );
  });

  it('throws when array contains non-string entries', async () => {
    await expect(loadAnswersFlag('["ok", 42]')).rejects.toThrow(
      /--answers must be a JSON array of strings/,
    );
  });
});
