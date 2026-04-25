export const PLAN_SYSTEM = `You are Draftwise, a codebase-aware product spec drafting tool.

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

export function buildPlanPrompt({ idea, scan, packageMeta }) {
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

export function parsePlanResponse(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
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

export const SPEC_SYSTEM = `You are Draftwise, a codebase-aware product spec drafting tool.

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

export function buildSpecPrompt({ idea, plan, scan, packageMeta, answers, opportunityDecisions }) {
  const qa = plan.clarifyingQuestions.map((q, i) => ({
    question: q.text,
    answer: answers[i] ?? '',
  }));
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

export function buildAgentInstruction(idea) {
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
