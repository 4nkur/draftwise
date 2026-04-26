import { describe, it, expect } from 'vitest';
import { mapConcurrent } from '../../src/utils/concurrency.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('mapConcurrent', () => {
  it('returns results in input order', async () => {
    const items = [1, 2, 3, 4, 5];
    const out = await mapConcurrent(items, 3, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapConcurrent(items, 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles an empty input', async () => {
    expect(await mapConcurrent([], 5, async () => 1)).toEqual([]);
  });

  it('caps workers to items.length when limit exceeds it', async () => {
    let peak = 0;
    let inFlight = 0;
    await mapConcurrent([1, 2], 10, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await sleep(2);
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('passes the index as the second arg to the worker', async () => {
    const out = await mapConcurrent(['a', 'b', 'c'], 2, async (item, i) => `${item}${i}`);
    expect(out).toEqual(['a0', 'b1', 'c2']);
  });

  it('propagates errors from the worker', async () => {
    await expect(
      mapConcurrent([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
