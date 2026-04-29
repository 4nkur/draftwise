> **Sets up `.draftwise/` for the user's project.** Asks whether the project is greenfield (no code yet) or brownfield (existing codebase) and routes accordingly. Writes `config.yaml` (AI mode + project state), `overview.md` (placeholder for brownfield, full plan for greenfield + api), and `scaffold.json` (greenfield only). Refuses to overwrite an existing `.draftwise/`.

Run the CLI first to see what it asks for:

```
!`draft init $ARGUMENTS`
```

What happened:

- **`.draftwise/` was created** ("Created .draftwise/ with…" appears): the user supplied enough flags and init finished. Report what was created and the `Next:` step the CLI suggested.

- **Structured handoff** (a block starting with "INIT — answer these in chat…"): the CLI is telling you what's still missing. Ask the user each numbered question conversationally — skip any conditional ones that don't apply (don't ask about provider if they pick `agent` mode; don't ask about idea if they pick `brownfield`). Once you have answers, re-invoke per the INSTRUCTION block:

  ```
  !`draft init --mode=<answer> --ai-mode=<answer> [--provider=<answer>] [--idea="<answer>"]`
  ```

  Then report what got created.

- **Error** (`Invalid --mode value`, `.draftwise/ already exists`, etc.): show the error verbatim and explain what the user should do.

Don't invent flag values. Don't write to `.draftwise/` yourself — re-invoke the CLI for any change.
