> **Drafts a technical spec from an approved product spec, grounded in the real codebase or greenfield plan.** Brownfield: every cited file must come from the scanner output. Greenfield: every cited file is marked `(new)` and follows the planned directory structure.

```
!`draft tech $ARGUMENTS`
```

What to do with the output:

- **agent mode** (PRODUCT SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/technical-spec.md` per the INSTRUCTION block. Brownfield: every cited file must come from the scanner output. Greenfield: mark every cited file `(new)`.

- **api mode success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/technical-spec.md"): the CLI wrote it. Confirm and surface the `Next:` step ("run `/draftwise tasks`").

- **Multiple specs, no slug given** (error: "Multiple product specs exist…"): show the user the available slugs and ask which one. Re-invoke `!`draft tech <slug>``.

- **Existing tech spec** (error: "already exists. Pass --force"): ask the user if they want to overwrite. If yes, re-invoke with `--force`.

- **No product specs yet** (error: "No product specs found"): tell the user to run `/draftwise new "<idea>"` first.
