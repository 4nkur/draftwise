export function buildAgentInstruction(idea, projectState = 'brownfield') {
  if (projectState === 'greenfield') {
    return `The PM has proposed a feature for a GREENFIELD project: "${idea}".

Before drafting, read .draftwise/constitution.md if it exists and apply its Voice and Spec language sections to the conversation and the final spec. Skip silently if the file is absent.

The project plan (overview.md above) describes the chosen stack and directory structure. There is no existing code yet. Run a conversation with the PM in three phases:

PHASE 1 — Plan the conversation:
  - Draft 4-8 clarifying questions specific to this feature on top of the chosen plan: user behavior, edge cases, integration points within the planned structure, scope, success criteria.
  - Don't ask stack-selection questions — that decision is in overview.md.
  - Don't try to enumerate "affected flows" — there are no existing flows yet.

PHASE 2 — Walk the PM through the questions:
  - Ask one clarifying question at a time. Wait for the answer.

PHASE 3 — Generate product-spec.md:
  - Sections in order: Problem, Users, User stories, Acceptance criteria, Edge cases, Test cases, Scope (covered/assumed/hypothesized/out of scope), Core metrics, Counter metrics.
  - Skip "Affected flows" and "Adjacent changes" — they don't apply for greenfield.
  - Save to .draftwise/specs/<feature-slug>/product-spec.md.

Hard rule: ASK don't assume; ground every claim in the answers and the project plan, never invented detail.`;
  }
  return `The PM has proposed: "${idea}".

Before drafting, read .draftwise/constitution.md if it exists and apply its Voice and Spec language sections to the conversation and the final spec. Skip silently if the file is absent.

Use the scanner data above as ground truth for the existing codebase. Run a conversation with the PM in three phases:

PHASE 1 — Plan the conversation (in your head, but share the plan with the PM):
  - Identify which existing flows this feature affects, citing real file paths from the scanner.
  - Draft 4-8 clarifying questions specific to the codebase (not generic). ASK, do not assume — every gap is a question.
  - Identify 2-5 adjacent flow opportunities — places where a related change should land alongside this feature so edge cases don't get generated. Each must point at a real existing flow.

PHASE 2 — Walk the PM through the questions and opportunities:
  - Ask one clarifying question at a time. Wait for the answer.
  - For each adjacent opportunity, present it and ask the PM to accept, decline, or defer.

PHASE 3 — Generate product-spec.md:
  - Use the PM's idea, scanner output, answers, and accept/decline decisions.
  - Follow the section order: Problem, Users, User stories, Acceptance criteria, Affected flows, Adjacent changes, Edge cases, Test cases, Scope (covered/assumed/hypothesized/out of scope), Core metrics, Counter metrics.
  - Reference real files/routes/models — do not invent.
  - Save to .draftwise/specs/<feature-slug>/product-spec.md (create the directory if needed).

Hard rules: ground every claim in the scanner; turn every gap into a question, not an assumption; keep the spec tight.`;
}
