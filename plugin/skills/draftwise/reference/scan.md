> **Refreshes the structured codebase overview.** Runs the scanner and prints the structured data plus an INSTRUCTION for you to write the narrated `overview.md`. Brownfield only — greenfield short-circuits with a friendly hint, since the plan from `init` already lives in `overview.md`.

## Pre-flight

- **`.draftwise/` exists?** If not, point at `/draftwise init`.
- **From the repo root?** The scanner walks the current working directory. If the user runs from a subdirectory, scope is wrong. The CLI's "No source files found" error catches this; flag it earlier if you can tell.

## Run

```
!`draftwise scan $ARGUMENTS`
```

## Reading the output

- **Agent handoff** (SCANNER OUTPUT and INSTRUCTION block): write `.draftwise/overview.md` per the INSTRUCTION, grounded only in the scanner data shown. Don't invent files, routes, or models that aren't there. Acknowledge the scanner's coverage (e.g. "scanner detected Next.js + Prisma; X routes, Y components, Z models") so the user trusts the basis.

- **Greenfield short-circuit** ("No code yet — `draftwise scan` works on existing codebases…"): tell the user this is brownfield-only and suggest `/draftwise new "<feature idea>"` instead — that's the next step in greenfield.

- **Errors**: `.draftwise/ not found` → run `/draftwise init` first; "No source files found" → run from the repo root.
