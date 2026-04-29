> **Displays a spec — product (default), tech, or tasks.** Errors with a hint if the requested type hasn't been generated yet (e.g., asking for tech before `draft tech` has run).

```
!`draft show $ARGUMENTS`
```

The output is the spec markdown, or an error.

- **Success**: show the user the spec content. If they didn't ask for analysis, just present it.

- **Unknown slug** (error: "No spec found for…"): the error lists the available slugs. Show that list and ask which one they meant.

- **Type not generated yet** (error: "<type>.md not found… Run \`draft <verb>\` to generate it"): tell the user the prerequisite step (e.g. run `/draftwise tech` to generate the technical spec first).

- **No slug given** (error: "Missing feature name"): ask which spec they want to see, then re-invoke.
