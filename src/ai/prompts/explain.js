export const SYSTEM = `You are Draftwise, a codebase-aware tool that traces flows through real code.

Your job in this turn is to walk through how a single flow works in the codebase the user just scanned. The output is read by PMs and engineers who need to understand what already exists before deciding what to change. Be specific and grounded.

Hard rules:
- Reference real file paths, real route paths, real function names from the scanner output. Do NOT invent.
- If the scanner output doesn't contain enough information to trace the flow confidently, say so explicitly under "Gaps". Don't fabricate steps.
- Keep the walkthrough tight. Engineers stop reading verbose docs.
- Output valid markdown only. No preamble like "Here is the trace" — start directly with the document.
`;

export function buildPrompt({ flow, scan, packageMeta }) {
  const parts = [
    `Trace how the "${flow}" flow works in this codebase. Use exactly these top-level sections, in order:`,
    '',
    `# Flow: ${flow}`,
    '> One-sentence summary of what this flow does, inferred from the code.',
    '',
    '## Entry points',
    'How does this flow start? List routes, UI components, scheduled jobs, or webhooks that trigger it. For each: file path, and what triggers it.',
    '',
    '## Walkthrough',
    'Step-by-step trace. Each step is one numbered line: what happens, with the file path and the function/handler name when known. 5-12 steps is the sweet spot.',
    '',
    '## Data read & written',
    'Bullet list of the models/tables touched. For each: read or write, and what fields are involved if known.',
    '',
    '## Side effects',
    'Bullet list of things this flow causes outside the request/response: emails, webhooks, async jobs, third-party API calls, cache invalidation, analytics events. Skip if none.',
    '',
    '## Edge cases handled',
    "Bullet list of edge cases the code visibly handles (auth failures, validation, rate limits, race conditions, etc.). If you can't see explicit handling, say so.",
    '',
    '## Gaps',
    'What you could NOT determine from the scanner output — files not parsed, services that look like they exist but the scanner missed, etc. Be honest.',
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

export function buildAgentInstruction(flow, slug) {
  return `The scanner data above describes a real codebase. The user wants to understand how the "${flow}" flow works. Generate a markdown walkthrough following the section structure shown, grounded only in what the scanner produced. Print the walkthrough to the user, then save it to .draftwise/flows/${slug}.md (create the flows directory if it doesn't exist). Do not invent files, routes, or functions that aren't in the scanner output.`;
}
