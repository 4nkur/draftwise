import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/utils/slug.js';

describe('slugify', () => {
  it('lowercases and dashifies words', () => {
    expect(slugify('User Signup')).toBe('user-signup');
  });

  it('strips punctuation and quotes', () => {
    expect(slugify('user "signup"!?')).toBe('user-signup');
  });

  it('collapses repeated separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });

  it('returns "flow" when input has no usable characters', () => {
    expect(slugify('!!!')).toBe('flow');
  });

  it('caps length at 60', () => {
    const long = 'word '.repeat(50);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});
