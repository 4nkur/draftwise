import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFrontmatter,
  readFrontmatter,
  asSlugList,
} from '../../src/utils/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses a simple frontmatter block and returns the body', () => {
    const src = `---\ndepends_on: [auth, billing]\nrelated: []\n---\n\n# Title\n\nBody.\n`;
    const { data, body } = parseFrontmatter(src);
    expect(data.depends_on).toEqual(['auth', 'billing']);
    expect(data.related).toEqual([]);
    expect(body).toBe('\n# Title\n\nBody.\n');
  });

  it('returns empty data and the full source when no frontmatter is present', () => {
    const src = '# Just a title\n\nBody.\n';
    const { data, body } = parseFrontmatter(src);
    expect(data).toEqual({});
    expect(body).toBe(src);
  });

  it('returns empty data when the YAML is malformed', () => {
    const src = '---\nnot: valid: yaml: here\n---\n\n# Title\n';
    const { data } = parseFrontmatter(src);
    expect(data).toEqual({});
  });

  it('returns empty data when the frontmatter parses to a non-object', () => {
    const src = '---\n- just\n- a\n- list\n---\n\nbody\n';
    const { data } = parseFrontmatter(src);
    expect(data).toEqual({});
  });

  it('handles CRLF line endings', () => {
    const src = `---\r\ndepends_on: [a]\r\n---\r\n\r\n# T\r\n`;
    const { data } = parseFrontmatter(src);
    expect(data.depends_on).toEqual(['a']);
  });
});

describe('readFrontmatter', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-fm-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads frontmatter from a file', async () => {
    const file = join(dir, 'spec.md');
    await writeFile(file, '---\ndepends_on: [x]\n---\n\n# T\n', 'utf8');
    const { data } = await readFrontmatter(file);
    expect(data.depends_on).toEqual(['x']);
  });

  it('returns empty data + body for a missing file', async () => {
    const result = await readFrontmatter(join(dir, 'nope.md'));
    expect(result).toEqual({ data: {}, body: '' });
  });
});

describe('asSlugList', () => {
  it('returns the array of strings unchanged when valid', () => {
    expect(asSlugList(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('trims whitespace and drops empties', () => {
    expect(asSlugList([' a ', '', 'b'])).toEqual(['a', 'b']);
  });

  it('drops non-string values', () => {
    expect(asSlugList(['a', 5, null, 'b'])).toEqual(['a', 'b']);
  });

  it('returns an empty array for non-array input', () => {
    expect(asSlugList(undefined)).toEqual([]);
    expect(asSlugList('a,b')).toEqual([]);
    expect(asSlugList({ a: 1 })).toEqual([]);
  });
});
