> **Generates ordered implementation tasks from an approved technical spec.** Each task: Goal / Files / Depends on / Parallel with / Acceptance, ordered so dependencies appear before dependents. Greenfield: the first 1-3 tasks are project scaffolding (run setup commands, install deps).

```
!`draft tasks $ARGUMENTS`
```

What to do with the output:

- **agent mode** (TECHNICAL SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/tasks.md` per the INSTRUCTION block. Numbered tasks with the five fields, dependency-ordered.

- **api mode success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/tasks.md"): the CLI wrote it. Remind the user the next step is to pick the first task with no dependencies and start shipping.

- **Multiple specs, no slug given**: show available slugs, ask which one, re-invoke.

- **Existing tasks.md** (error: "already exists. Pass --force"): ask the user if they want to overwrite. If yes, re-invoke with `--force`.

- **No tech specs yet** (error: "No technical specs found"): tell the user to run `/draftwise tech` first.
