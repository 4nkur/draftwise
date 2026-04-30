export function buildAgentInstruction(flow, slug) {
  return `The scanner data above describes a real codebase. The user wants to understand how the "${flow}" flow works.

Before writing the walkthrough, read .draftwise/constitution.md if it exists and apply its Voice and Spec language sections. Skip silently if the file is absent.

Generate a markdown walkthrough following this section structure, grounded only in what the scanner produced:

# Flow: ${flow}
> One-sentence summary of what this flow does, inferred from the code.

## Entry points
How does this flow start? List routes, UI components, scheduled jobs, or webhooks that trigger it. For each: file path, and what triggers it.

## Walkthrough
Step-by-step trace. Each step is one numbered line: what happens, with the file path and the function/handler name when known. 5-12 steps is the sweet spot.

## Data read & written
Bullet list of the models/tables touched. For each: read or write, and what fields are involved if known.

## Side effects
Bullet list of things this flow causes outside the request/response: emails, webhooks, async jobs, third-party API calls, cache invalidation, analytics events. Skip if none.

## Edge cases handled
Bullet list of edge cases the code visibly handles (auth failures, validation, rate limits, race conditions, etc.). If you can't see explicit handling, say so.

## Gaps
What you could NOT determine from the scanner output — files not parsed, services that look like they exist but the scanner missed, etc. Be honest.

Print the walkthrough to the user, then save it to .draftwise/flows/${slug}.md (create the flows directory if it doesn't exist). Do not invent files, routes, or functions that aren't in the scanner output.`;
}
