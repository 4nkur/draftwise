> **Traces a single flow through the codebase end-to-end.** Filters the scan to flow-keyword-relevant files so the model focuses on what matters. Saves a snapshot to `.draftwise/flows/<slug>.md`. Brownfield only — greenfield short-circuits.

```
!`draft explain $ARGUMENTS`
```

What to do with the output:

- **api mode** (streamed markdown ending with "Saved snapshot to .draftwise/flows/<slug>.md"): the CLI wrote the walkthrough. Briefly confirm and surface anything notable the trace called out.

- **agent mode** (SCANNER OUTPUT, FLOW: …, INSTRUCTION): generate the walkthrough yourself per the INSTRUCTION block, grounded in the scanner data and the flow keyword. Save to `.draftwise/flows/<slug>.md`. Don't invent files or functions not in the scanner output.

- **No flow argument** (error: "Missing flow name"): ask the user what flow they want traced (checkout, signup, photo upload, etc.), then re-invoke.

- **Greenfield short-circuit** ("No code yet"): tell the user `explain` is brownfield-only and suggest they come back once code exists.
