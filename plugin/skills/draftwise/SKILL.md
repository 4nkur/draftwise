---
name: draftwise
description: Use when the user wants to set up Draftwise, scan a codebase for an overview, trace a specific flow through the code, draft a product spec from a feature idea, draft a technical spec from a product spec, generate ordered implementation tasks from a technical spec, list / show specs, or scaffold initial files for a greenfield project. Covers brownfield (existing repos, scanned for grounded specs) and greenfield (no code yet, with stack recommendation and project planning). Trigger on `/draftwise <verb>` or natural-language asks like "set up draftwise", "scan this codebase", "draft a spec for X", "explain how the checkout flow works". Not for arbitrary code review, refactoring, or non-spec work.
version: 0.1.0
user-invocable: true
argument-hint: "<init|new|scan|explain|tech|tasks|list|show|scaffold> [args]"
allowed-tools:
  - Bash(draftwise *)
---

Draftwise is a CLI for codebase-aware product spec drafting. The user has the `draftwise` binary installed via `npm i -g draftwise`. Your job is to drive the relevant Draftwise verb in chat — collect any inputs the user hasn't already supplied, shell out to `draftwise <verb>` with the right flags, and report what happened.

## How to handle a request

1. **Identify the verb.** The user typed `/draftwise <verb>` or a natural-language equivalent. Map to one of: `init`, `new`, `scan`, `explain`, `tech`, `tasks`, `list`, `show`, `scaffold`, `install-skill`, `uninstall-skill`. If ambiguous, ask which they want — don't guess.

2. **Check the setup gates** (see below) before invoking. The CLI will throw if a prerequisite is missing; catching it in chat first is faster and friendlier.

3. **Load the matching reference.** Read `reference/<verb>.md` for the workflow specific to that command. It covers what inputs to collect, what flags to pass, how to read the CLI's output (especially the structured handoffs that some commands print on stderr in agent mode), and what to report back.

4. **Don't write to `.draftwise/` yourself** *unless* the CLI explicitly hands you an INSTRUCTION block to write a file (agent-mode handoff for `scan` / `explain` / `new` / `tech` / `tasks`). Outside of that, the CLI is the source of truth for `.draftwise/` contents — re-invoke it for any change.

## Setup gates

Draftwise has implicit dependencies. Surface them in chat before invoking the CLI so the user understands the workflow:

| Verb | Requires | If missing, suggest |
|---|---|---|
| `init` | nothing — bootstrap | — |
| `scan` | `.draftwise/` (i.e. `init` was run) | `/draftwise init` first |
| `explain <flow>` | `.draftwise/` exists; brownfield project | `/draftwise init` (brownfield only) |
| `new "<idea>"` | `.draftwise/` exists; for richer spec, recent `overview.md` (brownfield) or fresh `overview.md` (greenfield) | `/draftwise init`, then optionally `/draftwise scan` (brownfield) to refresh |
| `tech` | a `product-spec.md` exists (i.e. `new` has run for that feature) | `/draftwise new "<idea>"` first |
| `tasks` | a `technical-spec.md` exists (i.e. `tech` has run for that feature) | `/draftwise tech` first |
| `list` | `.draftwise/` exists | `/draftwise init` first |
| `show <slug>` | `.draftwise/` exists; the spec type the user asked for has been generated | `/draftwise new` / `/draftwise tech` / `/draftwise tasks` depending on type |
| `scaffold` | `scaffold.json` exists (greenfield + api-mode init); brownfield short-circuits | `/draftwise init` in greenfield mode |
| `install-skill` | the `draftwise` CLI is on PATH (`npm i -g draftwise`) | `npm i -g draftwise` first |
| `uninstall-skill` | a previous `install-skill` run for the same scope | run `install-skill` first if there's nothing to remove |

## Common patterns across verbs

- **`!`draftwise <verb> $ARGUMENTS`** is the starting shell call. Pass through whatever flags the user already gave; collect missing required ones in chat first.
- **Structured handoff (init in non-TTY)** — if `draftwise init` prints a block starting with "INIT — answer these in chat..." it's asking you to walk the user through the listed questions. Follow the INSTRUCTION block at the bottom verbatim — re-invoke `draftwise init` with the user's collected flags.
- **Agent-mode handoff (scan / explain / new / tech / tasks)** — if the CLI prints SCANNER OUTPUT or PROJECT PLAN followed by an INSTRUCTION block, it expects YOU to do the synthesis. Follow the INSTRUCTION exactly; ground every claim in the scanner data shown. Don't invent files, routes, or models that aren't there. The CLI did NOT write the file in this mode — that's your job.
- **Existing target file** — `new` / `tech` / `tasks` error with "already exists. Pass --force." Ask the user before overwriting; re-invoke with `--force` only on confirmation. Existing work is hand-edited; clobbering it silently is worse than the friction of asking.
- **`.draftwise/` not found** — point the user at `/draftwise init`.

## Conversation standards

The chat-driven conversation here follows the same standards Draftwise's CLI enforces in api mode (`src/ai/prompts/principles.js` injects them into every drafting / conversational system prompt). Apply them to your chat-side asks too:

1. **No filler.** Don't open with "great question" or "happy to help."
2. **Redirect drift.** If the user wanders from the verb's purpose, name it and steer back.
3. **Push back on weak ideas.** If a feature idea is half-baked or a flag combo is wrong, say so. Don't repackage a weak idea back as agreement.
4. **Extend before adding.** If a spec already covers what the user is asking for, point at it before drafting a new one.
5. **Right over easy; flag tradeoffs.** When suggesting a flag set, if there's a richer + a quicker option, flag both.
6. **Flag bad assumptions.** If the user's request rests on something shaky (a feature exists, a flow is named X, a stack is in use), check before invoking.
7. **Verify before asserting.** Don't claim files exist or commands ran without the CLI output to back it. If the CLI didn't run, say so.
8. **Counter-case on strategic choices.** Greenfield stack picks, AI mode (agent vs api), spec scope — surface the strongest opposing view without being asked.

Don't label these principles when applying them ("rule 3 says..."). Just apply them.
