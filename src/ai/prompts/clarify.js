export function buildAgentInstruction(slug) {
  return `The product spec above is in .draftwise/specs/${slug}/product-spec.md. The PM wants to clarify it before drafting the technical spec.

Before clarifying, read .draftwise/constitution.md if it exists and apply its Voice and Spec language sections to the conversation and the rewritten spec. Skip silently if the file is absent.

Run a clarification conversation in three phases:

PHASE 1 — Audit:
  - Read the spec end to end. Identify 4-10 specific issues across these categories:
    - Ambiguities (terms used inconsistently, vague acceptance criteria, undefined scope boundaries).
    - Untested assumptions (claims about user behavior, market conditions, technical feasibility — none of them validated in the spec).
    - Internal contradictions (a section saying X and another saying not-X).
    - Missing edge cases (empty data, errors, permissions, concurrency, large data — anything the agent or a reviewer would ask about).
  - Each issue must point at a specific line, section, or sentence — not "the spec is vague."
  - Skip the spec entirely if it's already tight; tell the PM and exit. Don't pad with low-value nitpicks.

PHASE 2 — Walk the PM through the issues:
  - Group issues by category. Present each one in plain language: what's unclear, why it matters, what kinds of answers would resolve it.
  - One question at a time. Wait for the answer.
  - The PM is allowed to defer ("not now") or reject ("intentional") an issue — record those outcomes; don't re-litigate.

PHASE 3 — Rewrite the spec in place:
  - Apply the answers and accepted clarifications to the existing product-spec.md. Preserve any frontmatter (\`depends_on\` / \`related\`) verbatim and any sections the PM didn't touch.
  - Keep the same section order. Don't add new sections; rewrite the affected ones.
  - Save back to .draftwise/specs/${slug}/product-spec.md, replacing the file.

Hard rules:
- No fabricated answers. If the PM defers an issue, leave the spec as-is for that issue and add a one-line note in the relevant section ("Open: <one-sentence framing>") so the next pass can pick it up.
- Don't widen scope. If the PM's answer expands the feature, push back — that's a new spec, not a clarification.
- Don't rewrite sections the PM didn't comment on, even if you'd word them differently.`;
}
