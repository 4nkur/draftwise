> **Sets up `.draftwise/` for the user's project.** Detects whether the directory is empty (no code yet — internally "greenfield") or contains an existing codebase (internally "brownfield") by scanning for source files, then routes accordingly. Writes `config.yaml` (project state) and `overview.md` (placeholder for existing codebase, placeholder for new project that the host agent rewrites from the conversation). Refuses to overwrite an existing `.draftwise/`.

## Run

```
!`draftwise init $ARGUMENTS`
```

## Reading the output

- **`.draftwise/` was created** ("Created .draftwise/ with…" appears): the user supplied enough flags (or none were needed for brownfield) and init finished. For greenfield, the CLI also printed a 3-phase INSTRUCTION block — follow it to walk the stack-selection conversation and rewrite `overview.md` plus `scaffold.json` for the user. For brownfield, just report what was created and the `Next:` step the CLI suggested. Done.

- **Structured handoff** (a block starting with "INIT — answer in chat…"): the CLI is telling you exactly what's still missing (greenfield without `--idea` is the only case). The first line of the handoff announces the auto-detected project state. Walk the user through the listed question, then re-invoke per the INSTRUCTION block.

- **Validation error** (`Invalid --mode value`, unknown flag, etc.): show the error verbatim and explain how to fix it. Don't try alternate flag spellings.

- **`.draftwise/ already exists`**: the bootstrap protection fired. Don't pre-emptively delete `.draftwise/` to "fix" it. Ask the user if they want to start over from scratch — and if yes, get explicit confirmation before doing anything destructive.

## Project state — auto-detected, not asked

The CLI checks the cwd for source files (using the same extension list and ignored-dirs as the scanner). Zero source files → "new project" (greenfield); one or more → "existing codebase" (brownfield). The handoff prints the result on the first line; relay that to the user in plain language ("Looks like a new project — no source files in this folder yet" or "Looks like an existing codebase — Draftwise found source files already"). Don't say "greenfield" or "brownfield" to the user unless they used those terms first; they're internal labels.

If the detection looks wrong (e.g. the user is starting fresh in a folder that happens to have a leftover script, or vice versa), pass `--mode=greenfield` or `--mode=brownfield` on the re-invocation. Confirm with the user before overriding.

## How to ask for the idea (greenfield only)

The CLI's only ask is the project idea (greenfield only). Add a sentence of context so the user can answer well: "A sentence or two on what you want to build — once init finishes I'll ask follow-up questions about stack and structure." If the user gives a one-word idea ("a blog", "a todo app"), ask for one more concrete sentence before invoking — the host-agent conversation goes much better with concrete input than with placeholder ideas.

## What to do after greenfield init finishes

The CLI's INSTRUCTION block tells you to walk the PM through three phases: (1) ask 4-6 clarifying questions about stack/structure, (2) propose 2-3 stack options with rationale/pros/cons/directory structure/setup commands, (3) write the chosen plan to `.draftwise/overview.md` plus `.draftwise/scaffold.json`. Follow the instruction's shape exactly — `scaffold.json` needs `stack`, `summary`, `directory_structure`, `initial_files`, and `setup_commands` fields so `draftwise scaffold` can use it later.

## What not to do

- Don't invent flag values to skip asking the user. The handoff lists exactly what's missing for a reason.
- Don't write to `.draftwise/` directly when init's still running — re-invoke the CLI with the collected flags. Once init has emitted its handoff and the conversation is in your hands, you do write `overview.md` and `scaffold.json` per the INSTRUCTION.
- Don't surface "greenfield" / "brownfield" in chat unless the user used those terms first. Use plain language: "new project (no code yet)" / "existing codebase".
