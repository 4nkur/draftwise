> **Drafts a technical spec from an approved product spec, grounded in the real codebase or greenfield plan.** Brownfield: every cited file must come from the scanner output. Greenfield: every cited file is marked `(new)` and follows the planned directory structure.

## Pre-flight

- **A product spec exists for this feature?** Run `/draftwise list` mentally (or peek at `.draftwise/specs/`) — if no `product-spec.md` exists for the slug the user wants, point at `/draftwise new "<idea>"` first. The tech spec grounds in the product spec; without one, there's nothing to ground in.
- **Has the user reviewed the product spec?** A tech spec is only as good as its product spec. If the user hasn't opened `.draftwise/specs/<slug>/product-spec.md` since it was generated, suggest a quick skim before invoking — drift between intent and tech is the most common reason tech specs get rewritten.

## Run

```
!`draftwise tech $ARGUMENTS`
```

## Reading the output

- **agent mode** (PRODUCT SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/technical-spec.md` per the INSTRUCTION block. Brownfield: every cited file must come from the scanner output. Greenfield: mark every cited file `(new)` and follow the planned directory structure from `overview.md`.

- **api mode success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/technical-spec.md"): the CLI wrote it. Confirm and surface the `Next:` step (`/draftwise tasks`).

- **Multiple specs, no slug given** (error: "Multiple product specs exist…"): show the available slugs and ask which one. Re-invoke `!`draftwise tech <slug>``.

- **Existing tech spec** (error: "already exists. Pass --force"): ask before overwriting. Existing tech specs are often hand-edited with engineering context; clobbering loses real work.

- **No product specs yet** (error: "No product specs found"): point at `/draftwise new "<idea>"`.
