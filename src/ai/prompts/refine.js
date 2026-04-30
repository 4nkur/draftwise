const TYPE_META = {
  product: {
    file: 'product-spec.md',
    sourcesBrownfield: 'the scanner output (the codebase as it exists today)',
    sourcesGreenfield: 'overview.md (the project plan + chosen stack)',
    forbidNewSections:
      'Don\'t add or remove sections. Preserve any YAML frontmatter (`depends_on:` / `related:`) at the top of the file verbatim.',
  },
  tech: {
    file: 'technical-spec.md',
    sourcesBrownfield: 'the product spec above plus the scanner output',
    sourcesGreenfield: 'the product spec above plus overview.md (the project plan + chosen stack)',
    forbidNewSections: 'Don\'t add or remove sections.',
  },
  tasks: {
    file: 'tasks.md',
    sourcesBrownfield: 'the technical spec above plus the scanner output',
    sourcesGreenfield: 'the technical spec above plus overview.md (the project plan + chosen stack)',
    forbidNewSections:
      'Don\'t change the task numbering scheme or drop tasks. You may rewrite task descriptions, but keep the same set of numbered tasks unless one is genuinely redundant.',
  },
};

export function buildAgentInstruction(slug, type, projectState = 'brownfield') {
  const meta = TYPE_META[type];
  if (!meta) {
    throw new Error(`Unknown spec type: ${type}`);
  }
  const sources =
    projectState === 'greenfield' ? meta.sourcesGreenfield : meta.sourcesBrownfield;

  return `The ${meta.file} above already exists in .draftwise/specs/${slug}/${meta.file}. The PM has hand-edited it since the last draft. Refine the file in place — preserve their edits, improve everything else.

Before refining, read .draftwise/constitution.md if it exists and apply its Voice and Spec language sections${
    type === 'tech' ? ', plus its Edge case discipline section' : ''
  }. Skip silently if absent.

Run a refinement pass in three phases:

PHASE 1 — Audit each section:
  - Walk the spec section by section. For each one, decide: strong or weak.
  - **Strong** = specific, grounded in real code/plan, written in active voice, internally consistent. The PM either wrote this themselves or the previous draft already nailed it. Leave it alone.
  - **Weak** = vague claims, generic placeholders, contradictions, ungrounded references, copy that reads like a template. These need rewriting.
  - Don't rewrite a section just because you'd word it differently. The bar is "this section actively misleads or under-specifies," not "this could be tighter."

PHASE 2 — Re-ground the weak sections:
  - For each weak section, re-ground it against ${sources}.
  - If the existing text references a file/route/model/component that doesn't appear in the source-of-truth, either remove the reference or mark it "(unverified)" — never silently keep a fabricated path.
  - Match the language style of the strong sections — voice, sentence length, level of specificity. The output should read as one coherent document, not a patchwork.

PHASE 3 — Write the file back:
  - Save the refined spec to .draftwise/specs/${slug}/${meta.file}, replacing the existing file.
  - ${meta.forbidNewSections}
  - Preserve the strong sections character-for-character. Only the weak sections change.

Hard rules:
- No fabricated code references. If the source-of-truth doesn't surface it, don't claim it exists.
- No scope creep. Refining means improving how the spec reads and how well it's grounded — not adding new features, edge cases, or requirements that weren't there before. If you spot a genuine gap, list it under "Open questions" (or the equivalent section if it exists) instead of writing new prose.
- Don't touch sections you'd classify as strong. If the whole spec is already strong, say so and exit without writing.`;
}
