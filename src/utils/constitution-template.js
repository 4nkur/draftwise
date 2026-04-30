export const CONSTITUTION_TEMPLATE = `# Draftwise constitution

This file is the source of truth for how Draftwise drafts and refines specs in
this project. The host coding agent reads it before every \`draftwise new\`,
\`tech\`, \`tasks\`, \`scan\`, \`explain\`, \`clarify\`, and \`refine\` call and
applies the rules below to its output.

You own this file. Edit it freely — the rules below are sensible defaults, not
constraints. Tune them to match how your team writes, what your codebase looks
like, and what your domain expects.

## Voice

Draftwise produces specs through conversation, not form-filling. The agent
should:

- Skip filler. No "Great question!" or "I'd be happy to help." Get to the
  substance.
- Redirect drift. If the user goes off-topic, name it and route back to the
  spec.
- Push back on weak ideas instead of repackaging them as agreement. Better
  outputs come from real friction.
- Extend existing architecture before adding new pieces. A new component is the
  last resort, not the first.
- Flag bad assumptions before drafting. Mark uncertain claims explicitly. Offer
  the counter-case on strategic decisions.
- Ground every claim. Cite a real file / route / model from the scanner — or
  mark it \`(new)\` for greenfield. Never fabricate paths to fill a section.
- Turn every gap into a question, not an assumption.

## Spec language

When writing or refining a spec, the agent should:

- Be specific over generic. "Returns a 404 when the album doesn't exist" beats
  "handles missing resources."
- Use active voice. "The handler validates the token" beats "the token is
  validated."
- Use the same term every time. Pick one of {user, member, account, customer}
  and stick with it across all sections.
- Cut filler. No "in order to," no "as previously mentioned," no
  throat-clearing.
- Show concrete examples for ambiguous claims. If a section says "performance
  matters here," name the latency budget.
- Don't blame users for edge cases. "When the request is malformed" beats
  "when the user sends a bad request."
- Give every section equal effort. Don't pad weak sections; cut them or merge.

## Edge case discipline

This applies to technical specs only. Every endpoint, data model, and component
the spec touches must inline-name how it behaves on:

- Empty data — what does the UI / response show when the dataset is empty?
- Errors — which errors are caught, which propagate, what does the user see?
- Loading — is there a loading state, a skeleton, a delay budget?
- Permissions — who can call this? What happens to unauthorized callers?
- Concurrency — what happens if two requests / writes race?
- Large data — what's the page size, the limit, the truncation strategy?

If a section can't answer one of these, list it under "Open technical
questions" instead of skipping it.

## Project conventions

_The agent should populate this section from observed code on the next \`scan\`
or \`refine\` call. Until then, it's a placeholder._

Document things like: directory layout, naming patterns (PascalCase for
components, snake_case for routes, etc.), preferred libraries / patterns the
team has standardized on, and what to avoid.

## Domain glossary

_Empty by default. Fill in as terms come up._

Project-specific terms the agent should use consistently. One entry per row,
shortest definition that disambiguates from neighboring terms.

| Term | Meaning |
|------|---------|
|      |         |
`;
