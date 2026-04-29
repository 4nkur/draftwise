> **Drafts a product spec for a feature idea.** Three phases driven by the CLI: (1) AI plans the conversation — clarifying questions tailored to the codebase or greenfield plan, plus affected flows and adjacent opportunities. (2) The user walks through questions and accepts/declines opportunities. (3) AI synthesizes `product-spec.md` under `.draftwise/specs/<slug>/`.

## Pre-flight

Before invoking the CLI, do a quick sanity check:

1. **`.draftwise/` exists?** If not, point the user at `/draft init` and stop. The CLI will throw on missing `.draftwise/`, but catching it in chat is cleaner.
2. **Idea concreteness.** If the user's idea is one word ("auth", "search", "sharing") or under ~10 chars, ask them to elaborate ONCE before invoking. The CLI's plan call is materially better with concrete input. Don't drag — one ask, then proceed with whatever they give.
3. **Brownfield staleness check** (optional). If `.draftwise/overview.md` is older than the most recent file in `src/` (or similar source dir), nudge once: "Your overview was generated before the latest code changes — `/draft scan` first for a more grounded spec." Don't block — proceed if the user wants to.
4. **Existing spec check.** Look at `/draft list` (or peek at `.draftwise/specs/`) — if a spec for the same area exists, surface it before drafting a new one. "Looks like you already have a `<slug>` spec — want to extend it (`--force` re-runs) or draft a separate feature?"

## Run

```
!`draft new $ARGUMENTS`
```

## Reading the output

- **agent mode** (you see SCANNER OUTPUT or PROJECT PLAN, then IDEA, then a 3-phase INSTRUCTION block): the CLI handed you the conversation. Follow the INSTRUCTION exactly — walk the user through clarifying questions, accept/decline adjacent opportunities, then write `product-spec.md` yourself grounded in the scanner data (or project plan, for greenfield). Don't invent files. The CLI did NOT write the spec in this mode; that's your job.

- **api mode, success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/product-spec.md"): the CLI already wrote it interactively. Confirm and surface the `Next:` step (`/draft tech`).

- **api mode + non-TTY without --answers** (the CLI logged "(non-interactive: no --answers supplied — questions left blank.)"): the model produced a leaner spec from its best guess. Walk the user through the clarifying questions yourself (the plan output above lists them), then re-invoke with `--answers '["a1", "a2"]' --force` for a richer spec.

- **Existing spec** (error: "already exists. Pass --force"): ask before overwriting. Existing specs are usually hand-edited; clobbering loses real work. Re-invoke with `--force` only on confirmation.

- **Missing idea** (error: "Missing idea"): ask what feature they want drafted, then re-invoke.
