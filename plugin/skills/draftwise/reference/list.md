> **Lists every spec under `.draftwise/specs/`.** Three columns: slug, status (which artifacts exist — product · tech · tasks), and the title from `product-spec.md`'s H1. Empty spec dirs show as `(empty)`.

## Pre-flight

- **`.draftwise/` exists?** If not, point at `/draftwise init`.

## Run

```
!`draftwise list`
```

## Reading the output

- **The table itself**: show it to the user as-is. It's the deliverable. If they're hunting for a specific spec, suggest `/draftwise show <slug> [product|tech|tasks]`.

- **"No specs yet"**: suggest `/draftwise new "<idea>"` to draft one.

- **Stale specs** (none generated in a while): not the CLI's job to flag, but if the table shows specs with only `product` (no tech / tasks), gently note that those features haven't progressed past product spec — useful context for the user's next step.
