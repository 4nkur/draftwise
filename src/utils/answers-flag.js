import { readFile } from 'node:fs/promises';

// Parses the value of `--answers` (used by `draftwise init` for greenfield
// clarifying questions and `draftwise new` for spec clarifying questions).
// Accepts either a raw JSON string (`["a", "b"]`) or `@path/to/file.json`.
//
// Returns the parsed array of strings, or `null` if the flag wasn't supplied.
// Throws with a usage hint on any failure (file unreadable, malformed JSON,
// wrong shape).

export async function loadAnswersFlag(value) {
  if (!value) return null;
  let raw;
  if (value.startsWith('@')) {
    try {
      raw = await readFile(value.slice(1), 'utf8');
    } catch (err) {
      throw new Error(
        `Could not read --answers file ${value.slice(1)}: ${err.message}`,
        { cause: err },
      );
    }
  } else {
    raw = value;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `--answers must be a JSON array (or @path-to-json-file). ${err.message}`,
      { cause: err },
    );
  }
  if (!Array.isArray(parsed) || !parsed.every((a) => typeof a === 'string')) {
    throw new Error('--answers must be a JSON array of strings.');
  }
  return parsed;
}
