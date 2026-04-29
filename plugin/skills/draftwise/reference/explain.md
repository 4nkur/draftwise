> **Traces a single flow through the codebase end-to-end.** Filters the scan to flow-keyword-relevant files so the model focuses on what matters. The CLI prints scanner data plus an INSTRUCTION for you to write the walkthrough to `.draftwise/flows/<slug>.md`. Brownfield only — greenfield short-circuits.

## Pre-flight

- **`.draftwise/` exists?** If not, point at `/draftwise init`.
- **Flow name supplied?** If the user invoked `/draftwise explain` with no argument, ask what flow they want traced before invoking. Examples to suggest: `checkout`, `signup`, `photo upload`, `password reset`. Concrete, single-noun flow names work best — the CLI's flow filter narrows the scan by keyword.

## Run

```
!`draftwise explain $ARGUMENTS`
```

## Reading the output

- **Agent handoff** (SCANNER OUTPUT, FLOW: …, INSTRUCTION): generate the walkthrough yourself per the INSTRUCTION block, grounded only in the scanner data and the flow keyword. Save to `.draftwise/flows/<slug>.md`. Don't invent files, routes, or functions that aren't in the scanner output.

- **Greenfield short-circuit**: tell the user `explain` is brownfield-only and suggest they come back once code exists.
