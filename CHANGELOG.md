# Changelog

All notable changes to **Draftwise** are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project tracks [Semantic Versioning](https://semver.org/).

Each released version is tagged in git (`v0.0.1`, `v0.1.0`, etc.) and includes the release date and the author who shipped it.

## [Unreleased]

### Added
- **CI workflow.** `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, and `npm test` on every PR and on pushes to `main`, against Node 20 and Node 22. Manual test-runs before merge are no longer the only safety net. — Ankur (#TBD)
- **Cache schema version.** `.draftwise/.cache/scan.json` now carries a `cacheVersion` field; mismatched versions are treated as a cache-miss instead of returning stale-shape data. Bump `CACHE_VERSION` in `src/utils/scan-cache.js` whenever scan output shape changes. — Ankur (#TBD)

### Changed
- **Bump Anthropic SDK retry budget from 2 to 4.** The SDK already retries on 429 / 5xx / network errors; we just give it a more generous default than ours used. Less hand-holding needed for transient blips. — Ankur (#TBD)
- **Parallelize per-file reads in scanner detectors.** The eight detector loops (Express/Fastify routes, Mongoose, Drizzle, FastAPI, Flask, Django routes, SQLAlchemy, Django models) used to read files sequentially — fine for small repos, painful on monorepos. Now use a 50-way bounded `mapConcurrent` from new `src/utils/concurrency.js`. Same matches, faster on big trees. — Ankur (#TBD)
- **Bump default Claude `max_tokens` to 16384 and expose `ai.max_tokens` in config.** The previous 8192 truncated overviews and tech specs on richly-scanned repos. Default raised; users can override via config (or set lower to cap costs). — Ankur (#TBD)
- **Extract shared `pathExists` and `compactScan` helpers.** The audit's two duplication smells — `pathExists` defined identically in 10 files, `compactScan` defined identically in 4 — now live in `src/utils/fs.js` and `src/utils/scan-projection.js` respectively. Pure refactor; no behavior change. The 14 consumer files import the shared versions and drop their local definitions (and the `access` import that only existed for `pathExists`). Going forward, any tuning to the prompt-sized scan projection happens in one place. Closes audit P2 #1 and #2. — Ankur (#TBD)

### Added
- **Shared collaboration principles in every drafting / conversational AI prompt.** New `src/ai/prompts/principles.js` exports a `CORE_PRINCIPLES` string injected at the top of `init` greenfield's QUESTIONS_SYSTEM and STACKS_SYSTEM, all four `new` system prompts (PLAN/SPEC × brownfield/greenfield), and both `tech` and `tasks` system prompts (brownfield + greenfield). The eight rules: no filler, redirect drift, push back on weak ideas (don't repackage them as agreement), extend before adding, right over easy, flag bad assumptions, verify before asserting, offer the counter-case on strategic decisions. Single source of truth — behavior changes once, propagates everywhere. — Ankur (#TBD)
- **`eslint.config.js`.** ESLint v10 flat config with sensible defaults for an ESM Node CLI. `npm run lint` now actually works — the project's own `lint` script was broken before this. Closes the audit's P0 finding. — Ankur (#TBD)
- **Tests for `src/ai/provider.js` and `src/ai/providers/claude.js`.** The provider router (unknown-provider error, missing-env-var error, openai/gemini stubs) and the Claude SDK adapter (response-block extraction, multi-block handling, empty-text detection, model defaulting / override, SDK error propagation) now have direct test coverage. Closes the audit's P1 — these were both production-critical paths with zero unit tests. — Ankur (#TBD)
- **Path-traversal guard in `draftwise scaffold`.** AI-supplied file paths in `scaffold.json` are now resolved with `path.resolve` and checked to stay under the project root. Anything that escapes (e.g. `../../etc/passwd`) is logged as `blocked` and skipped instead of being written. Closes a P1 from the audit. — Ankur (#TBD)
- **`DRAFTWISE_DEBUG=1` for stack traces.** When set, `src/index.js` prints `err.stack` plus any `cause:` chain on unexpected errors. Without it, only the message prints, with a one-line hint. Closes a P1 from the audit. — Ankur (#TBD)
- **`prepublishOnly` script.** `npm publish` now runs `npm test && npm run lint` first, so a broken main can't be released by accident. Closes a P1 from the audit. — Ankur (#TBD)

### Fixed
- **Preserve error chains across re-throws.** Five `throw new Error(...)` sites that wrapped a caught error were dropping the original — `src/utils/config.js`, both parsers in `src/ai/prompts/greenfield.js`, the parser in `src/ai/prompts/new.js`, and `src/commands/scaffold.js`. They now pass `{ cause: err }` so the inner stack is recoverable via `DRAFTWISE_DEBUG=1`. Caught by the new ESLint config's `preserve-caught-error` rule. — Ankur (#TBD)
- **Useless escapes in scanner regexes.** `src/core/scanner.js` had `\-` in two character classes where `-` at the end is unambiguous. Cosmetic; flagged by ESLint's `no-useless-escape`. — Ankur (#TBD)
- **Drop unused `cwd` arg from `runGreenfield`.** Was destructured but never used inside the function body — `draftwiseDir` is computed at the call site. — Ankur (#TBD)

## [0.1.0] — 2026-04-25 — Ankur

The "PMs starting from scratch" release. Draftwise now meets you wherever the project is — empty directory or established codebase — and the scanner reaches beyond JavaScript.

### Highlights

- **Greenfield project support.** `init` now asks whether you have an existing codebase or you're starting from scratch. Greenfield: walks you through 4–6 clarifying questions and proposes 2–3 stack options with rationale, pros, cons, directory structure, and setup commands. A new `draftwise scaffold` command turns the chosen plan into actual files. `new` / `tech` / `tasks` adapt their prompts when there's no code yet (every file marked `(new)`, scaffolding tasks first).
- **Python scanner support.** FastAPI, Starlette, Flask, Django, Tornado, plus SQLAlchemy and Django ORM. Reads `requirements.txt` or `pyproject.toml` (PEP 621 + Poetry). Parses decorator routes, Django `urls.py`, SQLAlchemy column bindings, and Django model fields.
- **Faster repeat runs.** Fingerprinted scan cache (`.draftwise/.cache/scan.json`) auto-invalidates on any file change. Configurable file cap via `scan.max_files` for monorepos. `explain` filters scan output to flow-relevant items so prompts stay tight.
- **Better feedback.** Friendly warnings when the scanner truncates due to file cap, when no framework is detected, and when running brownfield-only commands in a greenfield project.

### Added

- **Greenfield routing in `draftwise init`.** First prompt asks whether the project is greenfield or brownfield. Greenfield path runs a conversational stack-picking flow and writes a full plan to `overview.md` plus a structured `scaffold.json`. Agent-mode greenfield init dumps a 3-phase instruction for the host coding agent. `config.yaml` gains a `project` section (`state`, `stack`). — Ankur (#12)
- **Greenfield-aware `new` / `tech` / `tasks`.** Each command checks `config.projectState`. Greenfield path skips the scanner, reads `overview.md`, and uses prompt variants that drop scanner-grounded constraints — `affected_flows` / `adjacent_opportunities` removed for `new`, every file marked `(new)` for `tech`, scaffolding tasks first for `tasks`. `scan` and `explain` short-circuit gracefully in greenfield. — Ankur (#13)
- **`draftwise scaffold` command.** Reads the greenfield plan from `.draftwise/scaffold.json`, confirms with the user before writing, creates each `initial_files` entry with placeholder content, skips files that already exist, prints (does not run) the setup commands. — Ankur (#14)
- **Scanner robustness — file cap and framework warnings.** Default `maxFiles` of 5000, configurable via `scan.max_files`. Truncation surfaces a warning across every command. Missing-framework hint listed in `init` / `scan` when the scanner returns empty `frameworks`. Closes Q1 and Q5. — Ankur (#15)
- **Python scanner support.** Detects FastAPI / Starlette / Flask / Django / Tornado from `requirements.txt` or `pyproject.toml` (PEP 621 + Poetry tables). Parses FastAPI / Flask decorator-based routes, Django `urls.py` `path()` / `re_path()`, SQLAlchemy and Django ORM models. Excludes Python test files (`tests/`, `test_*.py`, `_test.py`, `conftest.py`) from route detection. — Ankur (#16)
- **Scanner cache and flow filter.** `cachedScan(root, opts)` fingerprints the tree by mtime + `maxFiles` and persists results at `.draftwise/.cache/scan.json`; `filterScanForFlow(scan, flow)` narrows routes / components / models to flow-keyword matches with per-category fallback. `init` writes a `.draftwise/.gitignore` excluding `.cache/`. Closes Q2 and Q4. — Ankur (#17)
- **`CHANGELOG.md`.** Single source of truth for release-by-release changes by tag ID / date / author. — Ankur (#19)
- **`.gitattributes` for cross-platform line-ending consistency.** Forces LF on commit and on checkout for source / config / docs / shell files. Silences "LF will be replaced by CRLF" warnings on Windows and keeps `bin/draftwise.js`'s shebang portable. — Ankur (#20)

### Changed

- **Docs synced with v1 reality.** CLAUDE.md "Build order for v1" replaced with "v1 status — all commands shipped". "Templates are authoritative" replaced with "Prompts are authoritative" pointing at `src/ai/prompts/<command>.js`. README roadmap items checked off. — Ankur (#10)
- **README compatibility claims qualified.** Agent-host list now reads "designed host-agnostic, smoke-tested in plain terminal so far" rather than implying every host on the list is verified. Standalone API providers explicitly marked: ✅ Claude / ⏳ GPT / ⏳ Gemini. Antigravity added to the agent-host list. — Ankur (#11)
- **Pruned resolved questions out of CLAUDE.md's Open questions section.** Resolved items moved to a new "Past decisions" section with implementation pointers, leaving "Open questions" for actually-open ones only. — Ankur (#18)

### Fixed

- **JS route detection no longer matches Python decorator syntax.** A doc comment in `src/core/scanner.js` (`@app.get("/path")`) was triggering the JS-route regex on a self-scan. Added a `(?<!@)` lookbehind. — Ankur (#16)

## [0.0.1] — 2026-04-25 — Ankur

First public release on npm.

### Added
- **`draftwise list` and `draftwise show <feature> [type]`.** File-system utilities, no AI. `list` prints a three-column table (slug, status, title from product-spec.md's H1). `show` prints any of the spec types (`product` / `tech` / `tasks`) with friendly errors for unknown slug or type, or for asking for a type that hasn't been generated yet. — Ankur (#9)
- **`draftwise tasks [<feature>]`.** Reads an approved technical-spec.md and drafts an ordered tasks.md (each with Goal, Files, Depends on, Parallel with, Acceptance). Spec selection mirrors `tech`: pass slug, auto-pick if one, prompt if many. — Ankur (#8)
- **`draftwise tech [<feature>]`.** Reads an approved product-spec.md and drafts technical-spec.md grounded in scanner output. Spec selection: pass slug, auto-pick if exactly one product spec, fall back to inquirer select if multiple. Hard rule: every cited file must come from the scanner; otherwise raise as an open technical question. — Ankur (#7)
- **`draftwise new "<idea>"`.** Three-phase conversational drafting: AI plan call returns JSON (`affected_flows`, `clarifying_questions`, `adjacent_opportunities`) → inquirer Q&A + accept/decline loop → AI synthesis writes `product-spec.md`. Hard rule: never assume — turn every gap into a question. — Ankur (#6)
- **`draftwise explain <flow>`.** Traces a single flow through the codebase end-to-end. Saves a snapshot to `.draftwise/flows/<slug>.md` in api mode; agent mode dumps scanner data + flow + instruction. — Ankur (#5)
- **`draftwise scan` with AI plumbing.** Runs the scanner and (api mode) calls the model to produce a narrated `overview.md`, or (agent mode) dumps scanner data + an instruction for the host coding agent. Adds `src/ai/provider.js` with Claude wired (`@anthropic-ai/sdk`) and OpenAI / Gemini stubbed. Scanner gains framework / route / component / model detection for JS/TS (Next.js pages + app router, Express / Fastify / Koa, Vue / Svelte components, Prisma / Mongoose / Drizzle models). Test-file exclusion via regex. — Ankur (#4)
- **`draftwise init`.** Creates `.draftwise/`, asks for AI mode (agent vs api), basic file-listing scan, writes `overview.md` placeholder + `config.yaml`. Refuses to clobber an existing `.draftwise/`. Switched to `@inquirer/prompts` for arrow-key menus. — Ankur (#2)
- **CLI scaffolding.** `bin/draftwise.js` (entry), `src/index.js` (router with dynamic imports), npm package wired (`type: module`, `bin.draftwise`, `engines.node >=20`, MIT). — Ankur (#1)

### Released
- Tagged `v0.0.1` and published to npm under name `draftwise`. — Ankur

[Unreleased]: https://github.com/4nkur/draftwise/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/4nkur/draftwise/releases/tag/v0.1.0
[0.0.1]: https://github.com/4nkur/draftwise/releases/tag/v0.0.1
