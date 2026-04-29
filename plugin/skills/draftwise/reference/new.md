> **Drafts a product spec for a feature idea.** The CLI prints scanner data (brownfield) or the greenfield plan plus a 3-phase INSTRUCTION for you to follow: (1) plan the conversation — clarifying questions tailored to the code/plan, plus affected flows and adjacent opportunities (brownfield only). (2) Walk the user through questions and accept/decline opportunities. (3) Write `product-spec.md` to `.draftwise/specs/<slug>/`. The CLI never writes the spec — that's your job.

## Pre-flight

Before invoking the CLI, do a quick sanity check:

1. **`.draftwise/` exists?** If not, point the user at `/draftwise init` and stop. The CLI will throw on missing `.draftwise/`, but catching it in chat is cleaner.
2. **Idea concreteness.** If the user's idea is one word ("auth", "search", "sharing") or under ~10 chars, ask them to elaborate ONCE before invoking. The synthesis goes much better with concrete input. Don't drag — one ask, then proceed with whatever they give.
3. **Brownfield staleness check** (optional). If `.draftwise/overview.md` is older than the most recent file in `src/` (or similar source dir), nudge once: "Your overview was generated before the latest code changes — `/draftwise scan` first for a more grounded spec." Don't block — proceed if the user wants to.
4. **Existing spec check.** Look at `/draftwise list` (or peek at `.draftwise/specs/`) — if a spec for the same area exists, surface it before drafting a new one. "Looks like you already have a `<slug>` spec — re-run to overwrite, or draft a separate feature?" Ask before clobbering hand-edits.

## Run

```
!`draftwise new $ARGUMENTS`
```

## Reading the output

- **Agent handoff** (SCANNER OUTPUT or PROJECT PLAN, IDEA, 3-phase INSTRUCTION block): follow the INSTRUCTION exactly. Walk the user through clarifying questions, accept/decline adjacent opportunities (brownfield only), then write `product-spec.md` yourself grounded in the scanner data (or project plan, for greenfield). Don't invent files. The CLI did NOT write the spec — that's your job.

- **Missing idea** (error: "Missing idea"): ask what feature they want drafted, then re-invoke.

- **Greenfield without overview** (error: "overview.md is missing or empty"): the user ran `init` in greenfield mode but the agent (you, on a previous turn) didn't write the plan. Either re-run `/draftwise init --mode=greenfield --idea="…"` and follow its INSTRUCTION this time, or write `overview.md` manually with the chosen stack + structure.
