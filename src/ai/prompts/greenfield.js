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
