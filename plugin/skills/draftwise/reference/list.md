> **Lists every spec under `.draftwise/specs/`.** Three columns: slug, status (which artifacts exist — product · tech · tasks), and the title from `product-spec.md`'s H1. Empty spec dirs show as `(empty)`.

```
!`draft list`
```

The output is the table. Show it to the user as-is. If they're looking for a specific spec, suggest `/draftwise show <slug> [product|tech|tasks]`.

If the output says "No specs yet," suggest `/draftwise new "<idea>"` to draft one.
