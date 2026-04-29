// Pull the JSON payload out of a model response that may or may not be wrapped
// in a markdown fence (```json ... ``` or ``` ... ```).
//
// Strategy: find the first opening fence; match it against the LAST fence in
// the document, so JSON values that contain nested ``` (e.g. a markdown
// directory tree inside a string) don't truncate the capture. If there's no
// fence at all, return the raw text trimmed — JSON.parse will give the caller
// a clean error if it's actually malformed.

export function extractJsonFromFence(text) {
  const opener = text.match(/```(?:json)?\s*\n?/);
  if (!opener) return text.trim();
  const start = opener.index + opener[0].length;
  const lastFence = text.lastIndexOf('```');
  if (lastFence <= start) return text.slice(start).trim();
  return text.slice(start, lastFence).trim();
}
