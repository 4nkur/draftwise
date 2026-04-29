---
name: draftwise
description: Use when the user wants to set up Draftwise, scan a codebase for an overview, trace a specific flow through the code, draft a product spec from a feature idea, draft a technical spec from a product spec, generate ordered implementation tasks from a technical spec, list / show specs, or scaffold initial files for a greenfield project. Covers brownfield (existing repos, scanned for grounded specs) and greenfield (no code yet, with stack recommendation and project planning). Trigger on `/draftwise <verb>` or natural-language asks like "set up draftwise", "scan this codebase", "draft a spec for X", "explain how the checkout flow works". Not for arbitrary code review, refactoring, or non-spec work.
version: 0.1.0
user-invocable: true
argument-hint: "<init|new|scan|explain|tech|tasks|list|show|scaffold> [args]"
allowed-tools:
  - Bash(draft *)
---

Draftwise is a CLI for codebase-aware product spec drafting. The user has the `draft` binary installed via `npm i -g draftwise`. Your job is to drive the relevant Draftwise verb in chat — collect any inputs the user hasn't already supplied, shell out to `draft <verb>` with the right flags, and report what happened.

## How to handle a request

1. **Identify the verb.** The user typed `/draftwise <verb>` or a natural-language equivalent. Map to one of: `init`, `new`, `scan`, `explain`, `tech`, `tasks`, `list`, `show`, `scaffold`. If ambiguous, ask the user which they want.

2. **Load the reference.** Read `reference/<verb>.md` for the workflow specific to that command — it covers what inputs to collect, what flags to pass, how to read the CLI's output (especially the structured handoffs that some commands print on stderr in agent mode), and what to report back.

3. **Don't write to `.draftwise/` yourself.** The CLI is the source of truth for `.draftwise/` contents. The only exception: in *agent mode* (configured during `draft init`), the CLI hands you scanner data + an INSTRUCTION block and expects you to write the file (an overview, a flow trace, or a spec). Follow the INSTRUCTION block precisely — do not invent files, routes, or models that aren't in the scanner output.

4. **Validate before invoking.** If the user's request implies a verb that requires `.draftwise/` to exist (everything except `init`) and you don't see signs that it's been set up, suggest running `/draftwise init` first before shelling out.

## Common patterns across verbs

- **`!`draft <verb> $ARGUMENTS`** is usually the starting shell call. Pass through whatever flags the user gave; collect missing required ones in chat first.
- **Structured handoff (init in non-TTY)** — if `draft init` prints a block starting with "INIT — answer these in chat..." it's asking you to walk the user through the listed questions and re-invoke with the collected flags. Follow the INSTRUCTION block at the bottom of that handoff verbatim.
- **Agent-mode handoff (scan / explain / new / tech / tasks)** — if the CLI prints SCANNER OUTPUT or PROJECT PLAN followed by an INSTRUCTION block, it expects you to do the synthesis: write the file grounded in the data shown. The CLI has *not* written the file in this mode.
- **Existing target file** — when a spec / plan already exists, `new` / `tech` / `tasks` error with "already exists. Pass --force." Ask the user if they want to overwrite; re-invoke with `--force` only on confirmation.
- **`.draftwise/` not found** — point the user at `/draftwise init`.

## Don't

- Don't fabricate scanner output or spec content. If the CLI gives you scanner data, ground every claim in it. If the CLI doesn't run, don't pretend it did.
- Don't skip the structured handoffs. They're how Draftwise tells you what to do next; ignoring them means the user gets nothing.
- Don't rewrite `.draftwise/config.yaml`, `overview.md`, or specs by hand when there's a CLI verb that does it. Re-invoke the CLI instead.
- Don't use `--force` without asking the user first.
