// Spec-quality rules. Drafting standards for the prose-shaped artifacts
// (product-spec.md and technical-spec.md): clarity, length, consistency,
// and edge-case coverage.
//
// Injected into the synthesis SYSTEM constants in `new.js` and `tech.js`,
// alongside CORE_PRINCIPLES. Plan/JSON calls don't get these — they don't
// draft prose. `tasks.js` doesn't either — task lists aren't prose-shaped
// and the existing prompt already pins the format tightly.
//
// Single source of truth — change behavior here, not in each prompt.

export const SPEC_LANGUAGE_RULES = `## How to write the spec (language and structure)

1. **Specific over generic.** "Users tap a 1-5 star widget; the average updates within 1s" beats "users can rate." "POST /api/albums returns 201 with the new album's id" beats "endpoint creates album."

2. **Active language, plain words.** Describe what users do or what the system produces — don't hide behind passive constructions or "the system shall" boilerplate. "Users save changes" not "Changes will be saved."

3. **Same term every time.** Pick one word per concept (user / customer / member; album / collection / set) and stick with it. Variation reads as a meaningful distinction even when it isn't.

4. **Cut filler.** Strike hedging ("we should probably consider"), restated headings (the section already names the topic), and any sentence that just rephrases the section above.

5. **Concrete examples for ambiguous claims.** Acceptance criteria and edge cases each earn a parenthetical example. "Limit 10 photos (selecting 12 → error, 0 uploaded)" beats just "limit of 10."

6. **Don't blame users.** Failure modes describe system behavior, not user mistakes. "Upload fails when file exceeds 10 MB" not "User attempts an invalid file size."

7. **Equal-effort sections.** If one section gets three bullets of detail, the next one doesn't get a hand-wave sentence. Sections at the same hierarchy level get the same level of treatment.`;

export const EDGE_CASE_DISCIPLINE = `## Edge cases for the technical spec

For every endpoint, model, or component this spec touches, name (inline in the relevant section) what happens for:
- **Empty data** — the collection has no rows yet, or the user has no relevant records
- **Errors** — 4xx/5xx for endpoints; validation failures for inputs; what the user actually sees
- **Loading** — operations slower than ~1s need feedback (skeleton, spinner, optimistic update)
- **Permissions** — who can't perform this action, and what they see instead
- **Concurrency** — double-submission, race conditions, optimistic-update conflicts
- **Large data** — pagination, virtualization, or an explicit cap when collections can grow past ~100 items

Designs that work only on perfect data aren't production-ready. Skip a category only if it genuinely doesn't apply — not from laziness.`;
