> **Generates ordered implementation tasks from an approved technical spec.** Each task: Goal / Files / Depends on / Parallel with / Acceptance, ordered so dependencies appear before dependents. Greenfield: the first 1-3 tasks are project scaffolding (run setup commands, install deps).

## Pre-flight

- **A technical spec exists for this feature?** If no `technical-spec.md` for the slug, point at `/draftwise tech` first. Tasks ground in the tech spec — without one, there's nothing to break down.
- **Has the user reviewed the tech spec?** Tasks are only as good as the tech spec they're derived from. If the user hasn't opened `technical-spec.md` since it was generated, suggest a skim — task ordering and granularity inherit from the tech spec's structure.

## Run

```
!`draftwise tasks $ARGUMENTS`
```

## Reading the output

- **agent mode** (TECHNICAL SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/tasks.md` per the INSTRUCTION block. Numbered tasks with the five fields, dependency-ordered. Greenfield: open with 1-3 scaffolding tasks (run setup commands, install deps, configure env).

- **api mode success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/tasks.md"): the CLI wrote it. Tell the user the next step is to pick the first task with no dependencies and start shipping.

- **Multiple specs, no slug given**: show available slugs, ask which one, re-invoke.

- **Existing tasks.md** (error: "already exists. Pass --force"): ask before overwriting. Tasks are sometimes hand-edited as work progresses (re-ordered, broken down further); clobbering loses that.

- **No tech specs yet**: point at `/draftwise tech`.
