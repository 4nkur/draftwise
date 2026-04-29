export function buildAgentInstruction(slug, projectState = 'brownfield') {
  if (projectState === 'greenfield') {
    return `The technical spec above is approved. The project is GREENFIELD — there's no existing code yet. The chosen stack and directory plan are in overview.md (above).

Generate tasks.md and save it to .draftwise/specs/${slug}/tasks.md.

Sections in order:
- Title + one-sentence framing
- Overview (note that the first tasks are project setup since this is greenfield)
- Tasks (numbered; each with Goal, Files, Depends on, Parallel with, Acceptance)
- Suggested execution order
- Open questions

Hard rules:
- Every file path is "(new)" and must match the directory structure from overview.md.
- The first 1-3 tasks must be foundational scaffolding (run setup commands, install deps, configure env). Don't skip them.
- Each "Depends on" link must point at a task number you've actually defined.`;
  }
  return `The technical spec above is approved. Use the scanner data as ground truth. Generate tasks.md following the section structure below, ordered so each task's dependencies appear before it. Save it to .draftwise/specs/${slug}/tasks.md.

Sections in order:
- Title + one-sentence framing
- Overview (2-3 sentences, total count + broad shape)
- Tasks (numbered, each with: Goal, Files, Depends on, Parallel with, Acceptance)
- Suggested execution order
- Open questions

Hard rules: real file paths only (mark new files "(new)"), don't pad with fluff tasks, each "Depends on" must point at a task number you've actually defined.`;
}
