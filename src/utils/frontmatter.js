import { readFile } from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(source) {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: source };
  let data;
  try {
    data = yamlParse(match[1]) ?? {};
  } catch {
    return { data: {}, body: source };
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { data: {}, body: source };
  }
  return { data, body: source.slice(match[0].length) };
}

export async function readFrontmatter(file) {
  let source;
  try {
    source = await readFile(file, 'utf8');
  } catch {
    return { data: {}, body: '' };
  }
  return parseFrontmatter(source);
}

export function asSlugList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
