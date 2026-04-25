export const SYSTEM = `You are Draftwise, a codebase-aware product spec drafting tool.

Your job in this turn is to read structured scanner output from a real codebase and produce a single overview.md document. The overview is the team's mental model of the product as it exists today — read by PMs, engineers, and new hires.

Hard rules:
- Be concrete. Reference real file paths, real route paths, real model names from the scanner output. Do NOT invent.
- If the scanner data is sparse or ambiguous, say so plainly. Don't paper over gaps with generic prose.
- Keep prose tight. PMs read this; verbosity erodes trust.
- Output valid markdown only. No preamble like "Here is the overview" — start directly with the document.
`;

export function buildPrompt({ scan, packageMeta }) {
  const parts = [
    'Generate an overview.md for this codebase. Use exactly these top-level sections, in order:',
    '',
    '# <Product name>  (use the package name as a starting point)',
    '> One-sentence description of what this product appears to do, inferred from the codebase.',
    '',
    '## What this codebase is',
    'A short paragraph (3-5 sentences) framing the product in plain language. Cite the framework(s) detected.',
    '',
    '## Major flows',
    'Bullet list of the top 5-8 user-facing flows you can infer from routes + components. For each: name, one-line description, and the entry-point file(s).',
    '',
    '## API surface',
    'Table or list of the routes/endpoints detected. For each: method, path, file. Group by area if natural.',
    '',
    '## Data model',
    'Bullet list of the data models/tables detected. For each: name, file, and 2-3 of its most important fields/relationships.',
    '',
    '## Components',
    'Bullet list of the most important UI components (cap at 15). Group by directory.',
    '',
    '## Integrations & external dependencies',
    'Bullet list of notable third-party dependencies inferred from package.json that hint at integrations (auth providers, payments, AI, queues, observability, etc.). Skip generic build tooling.',
    '',
    '## Gaps in this overview',
    'A short section listing what the scanner could NOT determine — e.g. flows the scanner missed, models not yet parsed, etc. Be honest.',
    '',
    '---',
    '',
    'Scanner output (structured JSON):',
    '```json',
    JSON.stringify(scan, null, 2),
    '```',
    '',
    'Package metadata:',
    '```json',
    JSON.stringify(packageMeta, null, 2),
    '```',
  ];
  return parts.join('\n');
}

export const AGENT_INSTRUCTION = `The scanner data above describes a real codebase. Generate an overview.md following the section structure shown, grounded only in what the scanner produced. Write the file to .draftwise/overview.md, replacing any placeholder content. Do not invent files, routes, or models that aren't in the scanner output.`;
