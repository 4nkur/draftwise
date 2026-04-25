# Changelog

All notable changes to **Draftwise** are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project tracks [Semantic Versioning](https://semver.org/).

Each released version is tagged in git (`v0.0.1`, `v0.1.0`, etc.) and includes the release date and the author who shipped it.

## [Unreleased]

### Added
- **Maintain CHANGELOG.md.** This file. Every functional PR going forward updates `[Unreleased]`; versioned sections move in when a release is tagged. — Ankur (#TBD)

### Changed
- **Prune resolved questions out of CLAUDE.md's Open questions section.** Real open items kept; resolved ones move into a new "Past decisions" section with implementation pointers. — Ankur (#18)

### Fixed
- **Stop matching Python decorator syntax in JS route detection.** A doc-comment example (`@app.get("/path")`) inside `src/core/scanner.js` was triggering the JS-route regex on a self-scan. Added a `(?<!@)` lookbehind. — Ankur (#16)

---

_The entries below were added retroactively from git history on 2026-04-25 — they describe everything that has shipped to `main` since `v0.0.1` but has not yet been published to npm._

### Added (post-0.0.1, unreleased on npm)
- **Scanner cache and flow filter.** `src/utils/scan-cache.js` introduces `cachedScan(root, opts)` — fingerprints the tree (file path + mtime, hashed with `maxFiles`), persists at `.draftwise/.cache/scan.json`, returns the cached result when fingerprints match. `src/utils/flow-filter.js` adds `filterScanForFlow(scan, flow)` — narrows routes/components/models to flow-keyword matches with per-category fallback to unfiltered. `init` now writes a `.draftwise/.gitignore` excluding `.cache/`. Closes Q2 and Q4. — Ankur (#17)
- **Python scanner support.** Detects FastAPI / Starlette / Flask / Django / Tornado from `requirements.txt` or `pyproject.toml` (PEP 621 + Poetry tables). Parses FastAPI / Flask decorator-based routes, Django `urls.py` `path()` / `re_path()`, SQLAlchemy and Django ORM models. Excludes Python test files (`tests/`, `test_*.py`, `_test.py`, `conftest.py`) from route detection. — Ankur (#16)
- **Scanner robustness — file cap and missing-framework warnings.** Default `maxFiles` of 5000; configurable via `scan.max_files` in `config.yaml`. Truncated scans surface a warning across every command. `init` and `scan` log an explicit "no framework detected" hint when the scanner returns empty `frameworks`. Closes Q1 and Q5. — Ankur (#15)
- **`draftwise scaffold`.** Reads `.draftwise/scaffold.json` (written by `init` in greenfield mode), confirms with the user before writing, creates each `initial_files` entry with placeholder content, skips conflicts, prints (does not run) the setup commands. — Ankur (#14)
- **Greenfield-aware `new` / `tech` / `tasks`.** Each command checks `config.projectState`. Greenfield path skips the scanner, reads `overview.md` (the project plan), and uses prompt variants that drop scanner-grounded constraints — affected_flows / adjacent_opportunities removed for `new`, every file marked `(new)` for `tech`, scaffolding tasks first for `tasks`. `scan` and `explain` short-circuit gracefully in greenfield with a hint pointing to the plan. — Ankur (#13)
- **Greenfield routing in `init`.** New first prompt asks whether the project is greenfield or brownfield. Greenfield path: idea → 4-6 clarifying questions → 2-3 stack options with rationale, pros, cons, directory structure, and setup commands → user picks one → writes a full plan to `overview.md` plus `scaffold.json`. Agent-mode greenfield init dumps a 3-phase instruction for the host coding agent. `config.yaml` gains a `project` section (`state`, `stack`). — Ankur (#12)

### Changed (post-0.0.1, unreleased on npm)
- **README compatibility claims qualified.** Agent-host list now reads "designed host-agnostic, smoke-tested in plain terminal so far" rather than implying every host on the list is verified. Standalone API providers explicitly marked: ✅ Claude / ⏳ GPT / ⏳ Gemini. Antigravity added to the agent-host list. — Ankur (#11)
- **Docs synced with v1 reality.** CLAUDE.md "Build order for v1" replaced with "v1 status — all commands shipped"; "Templates are authoritative" replaced with "Prompts are authoritative" pointing at `src/ai/prompts/<command>.js`. README roadmap items checked off. — Ankur (#10)

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

[Unreleased]: https://github.com/4nkur/draftwise/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/4nkur/draftwise/releases/tag/v0.0.1
