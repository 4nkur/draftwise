> **Generates ordered implementation tasks from an approved technical spec.** The CLI prints the technical spec plus scanner data (brownfield) or project plan (greenfield) and an INSTRUCTION for you to write `tasks.md`. Each task: Goal / Files / Depends on / Parallel with / Acceptance, ordered so dependencies appear before dependents. Greenfield: the first 1-3 tasks are project scaffolding (run setup commands, install deps).

## Pre-flight

- **A technical spec exists for this feature?** If no `technical-spec.md` for the slug, point at `/draftwise tech` first. Tasks ground in the tech spec — without one, there's nothing to break down.
- **Has the user reviewed the tech spec?** Tasks are only as good as the tech spec they're derived from. If the user hasn't opened `technical-spec.md` since it was generated, suggest a skim — task ordering and granularity inherit from the tech spec's structure.
- **Existing tasks.md?** If `tasks.md` already exists for the slug, ask before clobbering — tasks are sometimes hand-edited as work progresses (re-ordered, broken down further). The CLI doesn't guard against this; the conversation has to.

## Run

```
!`draftwise tasks $ARGUMENTS`
```

## Reading the output

- **Agent handoff** (TECHNICAL SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/tasks.md` per the INSTRUCTION block. Numbered tasks with the five fields, dependency-ordered. Greenfield: open with 1-3 scaffolding tasks (run setup commands, install deps, configure env).

- **Multiple specs, no slug given**: show available slugs, ask which one, re-invoke.

- **No tech specs yet**: point at `/draftwise tech`.
