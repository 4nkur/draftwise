import { describe, it, expect } from 'vitest';
import { extractJsonFromFence } from '../../src/utils/json-fence.js';

describe('extractJsonFromFence', () => {
  it('returns trimmed text when there is no fence', () => {
    expect(extractJsonFromFence('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('extracts from a ```json ... ``` block', () => {
    const text = 'preamble\n```json\n{"a":1}\n```\ntrailing';
    expect(extractJsonFromFence(text)).toBe('{"a":1}');
  });

  it('extracts from a bare ``` ... ``` block', () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJsonFromFence(text)).toBe('{"a":1}');
  });

  it('matches against the LAST fence so nested ``` inside JSON values stay intact', () => {
    // A stack option whose `directory_structure` field contains a markdown
    // tree wrapped in ``` would truncate if we matched the first closing
    // fence. Confirm the helper grabs the whole payload up to the final ```.
    const text = [
      '```json',
      '{',
      '  "directory_structure": "```',
      'src/',
      '  index.ts',
      '```"',
      '}',
      '```',
    ].join('\n');
    const extracted = extractJsonFromFence(text);
    expect(extracted.startsWith('{')).toBe(true);
    expect(extracted.endsWith('}')).toBe(true);
    expect(extracted).toContain('"directory_structure"');
  });

  it('returns the rest of the string when no closing fence appears', () => {
    const text = '```json\n{"a":1}';
    expect(extractJsonFromFence(text)).toBe('{"a":1}');
  });
});
