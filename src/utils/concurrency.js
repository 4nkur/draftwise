// Run an async function over a list with a concurrency cap. Returns the
// results in input order. Used by the scanner detectors so a monorepo
// with thousands of source files doesn't open a file descriptor for
// every match at once.
//
// Note: if `fn` throws for one item, `Promise.all` rejects with that
// error, but other workers in flight keep running until they finish
// (no cancellation signal). For the scanner use case this doesn't
// matter — `fn` swallows file-read errors internally and returns []
// — but if you reuse this helper for something with expensive `fn`
// calls and want early bail-out, wrap it with an AbortController.
export async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
