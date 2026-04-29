> **Displays a spec — product (default), tech, or tasks.** Errors with a hint if the requested type hasn't been generated yet (e.g., asking for tech before `draft tech` has run).

## Pre-flight

- **Slug supplied?** If not, ask which spec they want. If they don't know, suggest `/draft list` first.
- **Type supplied?** Default is `product`. If they ask for `tech` or `tasks`, those need to have been generated first (the CLI errors clearly if not).

## Run

```
!`draft show $ARGUMENTS`
```

## Reading the output

- **Success**: the spec markdown is the deliverable. Show it as-is. Don't summarize unless the user asked — specs are reviewed in full.

- **Unknown slug** (error: "No spec found for…"): the error lists the available slugs. Show that list and ask which one they meant.

- **Type not generated yet** (error: "<type>.md not found… Run \`draft <verb>\` to generate it"): point at the right verb (e.g. `/draft tech` to generate the technical spec first).

- **No slug given** (error: "Missing feature name"): ask which spec they want, then re-invoke.
