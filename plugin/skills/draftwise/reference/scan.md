> **Refreshes the structured codebase overview.** Runs the scanner and either writes a narrated `overview.md` (api mode) or hands the structured scanner data to you with an INSTRUCTION to write it (agent mode). Brownfield only — greenfield short-circuits with a friendly hint, since the plan from `init` already lives in `overview.md`.

```
!`draft scan $ARGUMENTS`
```

What to do with the output:

- **api mode** (streamed markdown ending with "Wrote .draftwise/overview.md"): the CLI wrote it. Confirm briefly and surface any scanner warnings + the `Next:` step.

- **agent mode** (SCANNER OUTPUT and INSTRUCTION block): write `.draftwise/overview.md` per the INSTRUCTION, grounded only in the scanner data shown. Don't invent files, routes, or models that aren't there.

- **Greenfield short-circuit** ("No code yet — `draft scan` works on existing codebases…"): tell the user this is brownfield-only and suggest `/draftwise new "<feature idea>"` instead.

- **Error** (`.draftwise/ not found` → run `/draftwise init` first; "No source files found" → run from the repo root).
