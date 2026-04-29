> **Sets up `.draftwise/` for the user's project.** Asks whether the project is greenfield (no code yet) or brownfield (existing codebase) and routes accordingly. Writes `config.yaml` (AI mode + project state), `overview.md` (placeholder for brownfield, full plan for greenfield + api), and `scaffold.json` (greenfield only). Refuses to overwrite an existing `.draftwise/`.

## Run

```
!`draftwise init $ARGUMENTS`
```

## Reading the output

- **`.draftwise/` was created** ("Created .draftwise/ with…" appears): the user supplied enough flags and init finished. Report what was created and the `Next:` step the CLI suggested. Done.

- **Structured handoff** (a block starting with "INIT — answer these in chat…"): the CLI is telling you exactly what's still missing. Walk the user through the listed questions (skipping any conditional ones that don't apply based on prior answers), then re-invoke per the INSTRUCTION block.

- **Validation error** (`Invalid --mode value`, unknown flag, etc.): show the error verbatim and explain how to fix it. Don't try alternate flag spellings.

- **`.draftwise/ already exists`**: the bootstrap protection fired. Don't pre-emptively delete `.draftwise/` to "fix" it. Ask the user if they want to start over from scratch — and if yes, get explicit confirmation before doing anything destructive.

## How to ask the questions (when the structured handoff fires)

The CLI's questions are minimal. Add a sentence or two of context so the user can answer well. Specifically:

- **Greenfield vs brownfield**: "Greenfield = empty directory, no code yet — Draftwise will help pick a stack and propose a plan. Brownfield = existing codebase — Draftwise scans it for an overview." If the user is in a directory with no source files, lean toward greenfield; if they're in a repo with code, lean toward brownfield. Confirm before assuming.

- **AI mode (agent vs api)**: "Agent mode = your IDE's model (Claude Code, Cursor, etc.) handles the reasoning — no API key needed; you stay in chat. API mode = Draftwise calls a model directly with your API key — more control, scriptable, runs without a host agent." Pick `agent` if they're using Claude Code right now and don't already have an Anthropic API key set up. Pick `api` if they want the CLI to be self-sufficient.

- **Provider (api mode only)**: "Claude is the only provider fully wired today; OpenAI and Gemini adapters are stubs. Pick `claude` unless you specifically want one of the others as a placeholder." Default to claude.

- **Idea (greenfield only)**: "A sentence or two on what you want to build — the model will ask follow-up questions about stack and structure once it has this." If the user gives a one-word idea ("a blog", "a todo app"), ask for one more concrete sentence before invoking — the CLI's plan call is much better with concrete input than with placeholder ideas.

## What not to do

- Don't invent flag values to skip asking the user. The handoff lists exactly what's missing for a reason.
- Don't write to `.draftwise/` directly. Re-invoke the CLI with the collected flags.
- Don't pick `--ai-mode=api` without confirming the user has the relevant API key in their environment — they'll hit a runtime error on the next verb otherwise.
