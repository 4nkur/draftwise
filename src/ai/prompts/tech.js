export function buildAgentInstruction(slug, projectState = 'brownfield') {
  if (projectState === 'greenfield') {
    return `The product spec above is approved. The project is GREENFIELD — there's no existing code yet. The chosen stack and directory plan are in overview.md (above).

Before drafting, read .draftwise/constitution.md if it exists and apply its Voice, Spec language, and Edge case discipline sections. Skip silently if the file is absent.

Generate technical-spec.md and save it to .draftwise/specs/${slug}/technical-spec.md.

Sections in order:
- Title + one-sentence framing
- Summary
- Data model changes (planned files, marked "(new)", in the chosen ORM's syntax)
- API changes (planned files, marked "(new)", in the chosen framework's conventions)
- Component changes (planned files, marked "(new)")
- Migration notes (setup ordering, env vars, services to wire up)
- Test plan (tied to acceptance criteria)
- Open technical questions

Hard rule: every file path must be marked "(new)" and must follow the directory structure from overview.md. Match the chosen stack's conventions exactly — don't impose foreign patterns.`;
  }
  return `The product spec above is approved. Use the scanner data as ground truth for the existing codebase.

Before drafting, read .draftwise/constitution.md if it exists and apply its Voice, Spec language, and Edge case discipline sections. Skip silently if the file is absent.

Generate the technical-spec.md following the section structure below, grounded in real files/routes/models from the scanner. Save it to .draftwise/specs/${slug}/technical-spec.md.

Sections in order:
- Title + one-sentence framing
- Summary
- Data model changes (cite real schema files; "_None._" if none)
- API changes (cite real route files; "_None._" if none)
- Component changes (cite real component files; "_None._" if none)
- Migration notes
- Test plan (tie to acceptance criteria)
- Open technical questions

Hard rule: never invent file paths or routes. If the product spec implies a change the scanner doesn't surface, list it under Open technical questions instead of fabricating a path.`;
}
