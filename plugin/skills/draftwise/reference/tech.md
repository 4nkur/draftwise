> **Drafts a technical spec from an approved product spec, grounded in the real codebase or greenfield plan.** The CLI prints the product spec, scanner data (brownfield) or project plan (greenfield), plus an INSTRUCTION for you to write `technical-spec.md`. Brownfield: every cited file must come from the scanner output. Greenfield: every cited file is marked `(new)` and follows the planned directory structure.

## Pre-flight

- **A product spec exists for this feature?** Run `/draftwise list` mentally (or peek at `.draftwise/specs/`) — if no `product-spec.md` exists for the slug the user wants, point at `/draftwise new "<idea>"` first. The tech spec grounds in the product spec; without one, there's nothing to ground in.
- **Has the user reviewed the product spec?** A tech spec is only as good as its product spec. If the user hasn't opened `.draftwise/specs/<slug>/product-spec.md` since it was generated, suggest a quick skim before invoking — drift between intent and tech is the most common reason tech specs get rewritten.
- **Existing tech spec?** If `technical-spec.md` already exists for the slug, ask the user before clobbering it. The CLI doesn't guard against this (it doesn't write the spec at all), so the conversation has to.

## Run

```
!`draftwise tech $ARGUMENTS`
```

## Reading the output

- **Agent handoff** (PRODUCT SPEC, SCANNER OUTPUT or PROJECT PLAN, INSTRUCTION): write `.draftwise/specs/<slug>/technical-spec.md` per the INSTRUCTION block. Brownfield: every cited file must come from the scanner output. Greenfield: mark every cited file `(new)` and follow the planned directory structure from `overview.md`.

- **Multiple specs, no slug given** (error: "Multiple product specs exist…"): show the available slugs and ask which one. Re-invoke `!`draftwise tech <slug>``.

- **No product specs yet** (error: "No product specs found"): point at `/draftwise new "<idea>"`.
