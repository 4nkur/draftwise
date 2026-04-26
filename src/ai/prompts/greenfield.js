export const QUESTIONS_SYSTEM = `You are Draftwise, helping a PM start a greenfield project from scratch. They've described what they want to build but haven't picked a stack or written any code yet.

Your job in this turn is NOT to recommend a stack. Your job is to ask the clarifying questions that will lead to a good stack recommendation. Different ideas need different questions — generate questions that are specifically useful for picking the stack and shape of THIS project.

Return ONE JSON object inside a single fenced \`\`\`json block. The shape:

{
  "project_title": "short, human-readable name derived from the idea (3-5 words max)",
  "questions": [
    { "text": "the question, phrased the way you'd ask a PM",
      "why": "what stack/structure decision this question informs" }
  ]
}

Hard rules:
- 4-6 questions total. Specific to the idea, not boilerplate. Bad: "What's your timeline?". Good (for a recipe-sharing app): "Will recipes be private to the user, shared with friends, or fully public — this affects whether you need an auth provider with social/sharing primitives?".
- The "why" line must connect each question to a specific stack/structure choice — frontend framework, backend approach, database, hosting, auth, etc.
- ASK, DO NOT ASSUME. If the idea is ambiguous in any way that affects stack choice, that's a question.
- Output JSON only. No prose around the fenced block.
`;

export function buildQuestionsPrompt(idea) {
  return [
    `PM's idea: "${idea}"`,
    '',
    'Generate the clarifying questions per the system instructions.',
  ].join('\n');
}

function extractJsonFromFence(text) {
  // Find an opening fence (```json or ```) and match against the LAST fence
  // in the document, so JSON values that contain nested ``` (e.g. a markdown
  // directory tree inside a string) don't truncate the capture.
  const opener = text.match(/```(?:json)?\s*\n?/);
  if (!opener) return text.trim();
  const start = opener.index + opener[0].length;
  const lastFence = text.lastIndexOf('```');
  if (lastFence <= start) return text.slice(start).trim();
  return text.slice(start, lastFence).trim();
}

export function parseQuestionsResponse(text) {
  const raw = extractJsonFromFence(text);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Could not parse the clarifying questions from the model response. ${err.message}\n\nResponse was:\n${text.slice(0, 500)}`,
      { cause: err },
    );
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Model response is missing the questions array.');
  }
  return {
    projectTitle: parsed.project_title ?? 'New project',
    questions: parsed.questions,
  };
}

export const STACKS_SYSTEM = `You are Draftwise, helping a PM pick a tech stack for a greenfield project. You have the PM's idea and their answers to clarifying questions. Now propose 2-3 stack options the PM can choose between.

Return ONE JSON object inside a single fenced \`\`\`json block. The shape:

{
  "stack_options": [
    {
      "name": "short, recognizable name (e.g. 'Next.js + Postgres + Prisma')",
      "summary": "one sentence on what this stack is and why it fits this idea",
      "rationale": "2-3 sentences on why this stack matches the answers above — be specific to the PM's constraints",
      "pros": ["3-5 concrete advantages, each one sentence"],
      "cons": ["2-4 honest tradeoffs or risks, each one sentence"],
      "directory_structure": "a markdown code block showing the proposed top-level + key inner directories (project root included). Use a tree style with --- or unicode box characters",
      "initial_files": [
        { "path": "relative path", "purpose": "what this file is for, one sentence" }
      ],
      "setup_commands": ["array of shell commands the PM can run to scaffold this stack, in order"]
    }
  ]
}

Hard rules:
- 2-3 options, no fewer, no more. They should be meaningfully different — don't propose three flavors of the same thing.
- Each option must be a complete answer (frontend + backend + data + hosting if relevant), not just a framework.
- "pros" and "cons" must be specific to this project's constraints, not generic feature lists.
- "directory_structure" must be realistic — show the actual scaffolding the PM will see after running the setup commands, not an idealized layout. Cap at ~25 lines.
- "initial_files" lists 4-8 files the PM should create or focus on first (config files, root pages, key models/routes — not every file in the scaffold). Mark as "(scaffold creates)" if it comes from the scaffolding command, "(write yourself)" otherwise.
- "setup_commands" should be runnable as-is, in order.
- Output JSON only. No prose around the fenced block.
`;

export function buildStacksPrompt({ idea, projectTitle, questions, answers }) {
  const qa = questions.map((q, i) => ({
    question: q.text,
    answer: answers[i] ?? '',
  }));
  return [
    `PM's idea: "${idea}"`,
    `Project title: ${projectTitle}`,
    '',
    'Answers to clarifying questions:',
    '```json',
    JSON.stringify(qa, null, 2),
    '```',
    '',
    'Propose 2-3 stack options per the system instructions.',
  ].join('\n');
}

export function parseStacksResponse(text) {
  const raw = extractJsonFromFence(text);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Could not parse the stack options from the model response. ${err.message}\n\nResponse was:\n${text.slice(0, 500)}`,
      { cause: err },
    );
  }
  if (!Array.isArray(parsed.stack_options) || parsed.stack_options.length === 0) {
    throw new Error('Model response is missing the stack_options array.');
  }
  for (const opt of parsed.stack_options) {
    if (!opt.name || !opt.summary) {
      throw new Error('A stack option is missing name or summary.');
    }
  }
  return parsed.stack_options;
}

export function buildOverviewMarkdown({ projectTitle, idea, questions, answers, chosen }) {
  const qa = questions
    .map((q, i) => `**${q.text}**\n${answers[i]?.trim() || '_(skipped)_'}`)
    .join('\n\n');
  const pros = (chosen.pros ?? []).map((p) => `- ${p}`).join('\n');
  const cons = (chosen.cons ?? []).map((c) => `- ${c}`).join('\n');
  const initialFiles = (chosen.initial_files ?? [])
    .map((f) => `- \`${f.path}\` — ${f.purpose}`)
    .join('\n');
  const setup = (chosen.setup_commands ?? [])
    .map((c) => `\`\`\`bash\n${c}\n\`\`\``)
    .join('\n');

  return `# ${projectTitle} — Greenfield plan

> ${idea}

_This is a greenfield plan written before any code exists. Once you've scaffolded the project and written some code, run \`draftwise scan\` to replace this with a codebase-grounded overview._

## Idea

${idea}

## Discovery

${qa}

## Chosen stack: ${chosen.name}

${chosen.summary}

**Why this fits:** ${chosen.rationale}

### Pros
${pros}

### Cons
${cons}

## Directory structure

${chosen.directory_structure}

## Initial files

${initialFiles}

## Setup

Run these commands from your project root, in order:

${setup}

## Next steps

1. Run the setup commands above to scaffold the project.
2. Create the initial files listed.
3. Once you have some code on disk, \`draftwise scan\` will refresh this overview from the actual codebase.
4. \`draftwise new "<feature idea>"\` to draft your first feature spec.
`;
}

export function buildAgentInstruction(idea) {
  return `The PM has proposed a greenfield project: "${idea}".

There is no existing code to scan. Run a conversation with the PM to produce a greenfield plan, in three phases:

PHASE 1 — Clarify:
  - Ask 4-6 clarifying questions specific to this idea. Each question must connect to a stack/structure decision (frontend framework, backend, data, hosting, auth, etc.). ASK, do not assume.
  - Wait for answers.

PHASE 2 — Recommend stacks:
  - Propose 2-3 meaningfully different stack options. For each, share: name, one-sentence summary, rationale tied to the PM's answers, pros (3-5), cons (2-4), proposed directory structure, initial files to create (4-8), and setup commands.
  - Ask the PM to pick one.

PHASE 3 — Write the plan:
  - Save the chosen stack and the conversation as .draftwise/overview.md, with sections: Idea, Discovery (Q&A), Chosen stack (name, summary, rationale, pros, cons), Directory structure, Initial files, Setup commands, Next steps.
  - Also save .draftwise/scaffold.json with the structured stack data so \`draftwise scaffold\` can use it later. Shape:
    {
      "stack": "<chosen stack name>",
      "summary": "<one-sentence summary>",
      "directory_structure": "<the markdown tree>",
      "initial_files": [{ "path": "...", "purpose": "..." }],
      "setup_commands": ["...", "..."]
    }
  - Tell the PM the next steps: run setup commands, optionally \`draftwise scaffold\` to create initial files, then \`draftwise scan\` once code exists, or \`draftwise new "<feature idea>"\` to draft a feature spec.

Hard rules: ASK don't assume; stack options must be meaningfully different (not three flavors of the same thing); pros/cons must be specific to this project, not generic.`;
}
