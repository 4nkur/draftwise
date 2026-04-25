export const PLAN_SYSTEM_BROWNFIELD = `You are Draftwise, a codebase-aware product spec drafting tool.

A PM has proposed a new feature for a real codebase. Your job in this turn is NOT to write the spec yet. Your job is to plan the conversation that will lead to a good spec.

You will receive: the PM's idea, the structured scanner output for the existing codebase. You will return ONE JSON object — no preamble, no prose around it, just the JSON inside a single fenced \`\`\`json block.

The JSON has exactly this shape:

{
  "feature_slug": "kebab-case-feature-name (3-5 words max, derived from the idea)",
  "feature_title": "human-readable title for the feature",
  "affected_flows": [
    { "name": "flow name (use existing names from the scanner if applicable)",
      "files": ["concrete file paths from the scanner"],
      "impact": "one sentence describing how this feature changes this flow" }
  ],
  "clarifying_questions": [
    { "text": "the question, phrased the way you'd ask a PM",
      "why": "what gap in your understanding this question fills — be specific to the codebase" }
  ],
  "adjacent_opportunities": [
    { "flow": "name of an adjacent flow",
      "suggestion": "what change to that flow could / should land alongside this feature",
      "rationale": "why this matters — usually surfaces an edge case that would otherwise leak into review" }
  ]
}

Hard rules:
- ASK, DO NOT ASSUME. If something is unclear (target user, success metric, integration point, error handling, permissioning, payment, notifications), turn it into a clarifying_question. Never invent details to fill gaps.
- Ground every affected_flow in real files from the scanner. If you can't see the affected flow in the scanner output, say so via a clarifying_question instead.
- 4-8 clarifying questions. Specific to the codebase, not generic. Bad: "Who is the target user?". Good: "The scanner shows two user roles in src/auth/roles.ts — admin and member. Which of these (or a new role) gets access to this feature?".
- 2-5 adjacent_opportunities. Each must point at a real existing flow the scanner detected. Skip the section if there are genuinely none.
- Output JSON only. No markdown around it except the single fenced block.
`;

export const PLAN_SYSTEM_GREENFIELD = `You are Draftwise, a product spec drafting tool. The PM is scoping a feature for a GREENFIELD project — there's no existing code yet. They've already chosen a stack and a directory plan, captured in overview.md.

Your job in this turn is NOT to write the spec yet. Your job is to plan the conversation by generating clarifying questions tailored to this feature on top of the chosen plan.

Return ONE JSON object inside a single fenced \`\`\`json block:

{
  "feature_slug": "kebab-case (3-5 words)",
  "feature_title": "human-readable title",
  "clarifying_questions": [
    { "text": "the question",
      "why": "what gap this fills — be specific to the project plan" }
  ]
}

Hard rules:
- ASK, DO NOT ASSUME. 4-8 clarifying questions specific to this feature on top of the chosen stack: user behavior, edge cases, integration points within the planned structure, scope boundaries, success criteria.
- Don't ask stack-selection questions — that decision is already made (see overview.md).
- Don't generate affected_flows or adjacent_opportunities — there are no existing flows yet. If integration with the planned structure matters, surface it as a clarifying question.
- Output JSON only. No markdown around the fenced block.
`;

export function selectPlanSystem(projectState) {
  return projectState === 'greenfield'
    ? PLAN_SYSTEM_GREENFIELD
    : PLAN_SYSTEM_BROWNFIELD;
}

export function buildPlanPrompt({ idea, scan, packageMeta, projectState, overview }) {
  if (projectState === 'greenfield') {
    return [
      `PM's idea: "${idea}"`,
      '',
      'Project plan (overview.md — chosen stack, directory structure, setup):',
      overview && overview.trim()
        ? overview
        : '_(no overview.md found; treat the idea as the only context)_',
      '',
      'Generate clarifying questions per the system instructions.',
    ].join('\n');
  }
  return [
    `PM's idea: "${idea}"`,
    '',
    'Codebase scanner output (structured):',
    '```json',
    JSON.stringify(scan, null, 2),
    '```',
    '',
    'Package metadata:',
    '```json',
    JSON.stringify(packageMeta, null, 2),
    '```',
    '',
    'Return the conversation plan as JSON inside a single fenced ```json block, per the system instructions.',
  ].join('\n');
}

function extractJsonFromFence(text) {
  const opener = text.match(/```(?:json)?\s*\n?/);
  if (!opener) return text.trim();
  const start = opener.index + opener[0].length;
  const lastFence = text.lastIndexOf('```');
  if (lastFence <= start) return text.slice(start).trim();
  return text.slice(start, lastFence).trim();
}

export function parsePlanResponse(text) {
  const raw = extractJsonFromFence(text);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Could not parse the plan from the model response. ${err.message}\n\nResponse was:\n${text.slice(0, 500)}`,
    );
  }
  if (!parsed.feature_slug || !Array.isArray(parsed.clarifying_questions)) {
    throw new Error(
      'Model response is missing required fields (feature_slug or clarifying_questions).',
    );
  }
  return {
    featureSlug: parsed.feature_slug,
    featureTitle: parsed.feature_title ?? parsed.feature_slug,
    affectedFlows: parsed.affected_flows ?? [],
    clarifyingQuestions: parsed.clarifying_questions,
    adjacentOpportunities: parsed.adjacent_opportunities ?? [],
  };
}

export const SPEC_SYSTEM_BROWNFIELD = `You are Draftwise, a codebase-aware product spec drafting tool.

You have the PM's idea, the codebase scanner output, the PM's answers to clarifying questions, and the PM's accept/decline decisions on adjacent flow opportunities. Your job in this turn is to write the final product-spec.md.

The spec is a markdown document with these sections, in order:

# <Feature title>

> One-sentence description of what this feature is.

## Problem
What's broken or missing today, with concrete evidence from the codebase or the PM's answers. No generic language.

## Users
Who this is for, drawn from the PM's answer about target users. Reference real user roles from the codebase if applicable.

## User stories
3-7 stories in "As a <user>, I want <action>, so that <outcome>" form.

## Acceptance criteria
Given/when/then bullets. Concrete, testable.

## Affected flows
For each flow this feature touches: name, files, what changes. Pull this directly from the affected_flows in the plan, refined by the PM's answers.

## Adjacent changes
For each adjacent_opportunity the PM accepted: include it here as a sibling change with rationale. Skip declined ones.

## Edge cases
Edge cases the PM surfaced in answers, plus any that fall out of the affected_flows analysis. Each one: what could go wrong, what should happen.

## Test cases
Product-level scenarios (not unit tests). Happy path + each edge case.

## Scope
Four sub-bullets:
- **Covered:** what this spec includes
- **Assumed:** what we're taking as given
- **Hypothesized:** what we believe but haven't proven
- **Out of scope:** what this spec explicitly excludes

## Core metrics
What success looks like. Measurable.

## Counter metrics
What could go wrong if we succeed too hard.

Hard rules:
- Reference real files, real routes, real models from the scanner. No inventing.
- If a section has no content (e.g. no adjacent changes accepted), keep the heading but write "_None._" — don't fabricate.
- Output the markdown only. No preamble. Start with the title.
`;

export const SPEC_SYSTEM_GREENFIELD = `You are Draftwise. The PM is scoping a feature for a GREENFIELD project. You have the idea, the project plan (overview.md — chosen stack, directory structure), and answers to clarifying questions. Write product-spec.md.

The spec has these sections, in order:

# <Feature title>

> One-sentence description.

## Problem
Concrete; cite what the PM said in answers. No generic prose.

## Users
Who this is for, drawn from answers.

## User stories
3-7 stories in "As a <user>, I want <action>, so that <outcome>" form.

## Acceptance criteria
Given/when/then bullets. Concrete, testable.

## Edge cases
What could go wrong, what should happen. Anchor in the answers; don't invent.

## Test cases
Product-level scenarios. Happy path + each edge case.

## Scope
Four sub-bullets:
- **Covered:** what this spec includes
- **Assumed:** what we're taking as given
- **Hypothesized:** what we believe but haven't proven
- **Out of scope:** what this spec explicitly excludes

## Core metrics
What success looks like. Measurable.

## Counter metrics
What could go wrong if we succeed too hard.

Hard rules:
- Greenfield project — there are no existing flows or files. Don't include "Affected flows" or "Adjacent changes" sections; they don't apply.
- If something feels like an integration with the planned structure, mention the planned file/component (from overview.md) but mark it forward-looking.
- If a section has no content, write "_None._" — don't fabricate.
- Output the markdown only. No preamble. Start with the title.
`;

export function selectSpecSystem(projectState) {
  return projectState === 'greenfield'
    ? SPEC_SYSTEM_GREENFIELD
    : SPEC_SYSTEM_BROWNFIELD;
}

export function buildSpecPrompt({
  idea,
  plan,
  scan,
  packageMeta,
  answers,
  opportunityDecisions,
  projectState,
  overview,
}) {
  const qa = plan.clarifyingQuestions.map((q, i) => ({
    question: q.text,
    answer: answers[i] ?? '',
  }));

  if (projectState === 'greenfield') {
    return [
      `PM's idea: "${idea}"`,
      `Feature slug: ${plan.featureSlug}`,
      `Feature title: ${plan.featureTitle}`,
      '',
      'Project plan (overview.md):',
      overview && overview.trim()
        ? overview
        : '_(no overview.md found)_',
      '',
      "PM's answers to clarifying questions:",
      '```json',
      JSON.stringify(qa, null, 2),
      '```',
      '',
      'Write the full product-spec.md per the system instructions.',
    ].join('\n');
  }

  const opportunities = plan.adjacentOpportunities.map((o, i) => ({
    flow: o.flow,
    suggestion: o.suggestion,
    rationale: o.rationale,
    decision: opportunityDecisions[i] ?? 'declined',
  }));

  return [
    `PM's idea: "${idea}"`,
    `Feature slug: ${plan.featureSlug}`,
    `Feature title: ${plan.featureTitle}`,
    '',
    'Affected flows (from scanner + plan):',
    '```json',
    JSON.stringify(plan.affectedFlows, null, 2),
    '```',
    '',
    "PM's answers to clarifying questions:",
    '```json',
    JSON.stringify(qa, null, 2),
    '```',
    '',
    "PM's decisions on adjacent opportunities:",
    '```json',
    JSON.stringify(opportunities, null, 2),
    '```',
    '',
    'Codebase scanner output (for grounding references):',
    '```json',
    JSON.stringify(scan, null, 2),
    '```',
    '',
    'Package metadata:',
    '```json',
    JSON.stringify(packageMeta, null, 2),
    '```',
    '',
    'Write the full product-spec.md per the system instructions.',
  ].join('\n');
}

export function buildAgentInstruction(idea, projectState = 'brownfield') {
  if (projectState === 'greenfield') {
    return `The PM has proposed a feature for a GREENFIELD project: "${idea}".

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

// Backwards compatibility — keep the old names alive as aliases.
export const PLAN_SYSTEM = PLAN_SYSTEM_BROWNFIELD;
export const SPEC_SYSTEM = SPEC_SYSTEM_BROWNFIELD;
