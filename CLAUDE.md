# CLAUDE.md

Context for Claude Code when working on this repo.

---

## What we're building

Draftwise is a product spec drafting tool for PMs and product builders. It supports two starting points:

- **Brownfield (existing codebase):** makes the codebase legible. Explains what already exists, traces how specific flows work today, drafts product and technical specs that fit the real code.
- **Greenfield (no code yet):** asks clarifying questions about the idea, recommends 2-3 stack options with rationale + pros + cons, proposes a directory structure, and lays out the first setup commands.

The four primary jobs Draftwise does:

1. **Explains the product back to its team (brownfield).** New PMs use it to onboard. Existing PMs use it to verify their mental model before drafting.
2. **Traces current behavior (brownfield).** Walk through how a specific flow actually works in the codebase, end to end.
3. **Guides the start of a new project (greenfield).** Helps a PM go from "I have an idea" to "here's the stack, the structure, and the first commands to run" — grounded in their constraints, not generic boilerplate.
4. **Drafts grounded specs (both).** When a PM proposes a feature, the spec references real components, endpoints, schemas (brownfield) or proposed ones with `(new)` markers (greenfield) — never generic placeholders.

Everything Draftwise produces lives in `.draftwise/` inside the user's repo. Markdown files, version-controlled, alongside the code.

---

## Why Draftwise exists

The problem is well documented in the README. The short version: PMs writing specs don't have the codebase in their head. So they either spend hours on detective work, or they write generic specs that engineers redo from scratch. New PMs joining a product face the same wall — old docs don't match the code, and it takes weeks to build a working mental model.

Draftwise solves this by making the codebase the source of truth and the AI the translator. The codebase is read, understood, and made legible. Specs are drafted on top of that understanding.

If you're proposing a feature for Draftwise, the test is: **does this make the codebase more legible, or does it make spec drafting more grounded in the codebase?** If neither, it doesn't belong in v1.

---

## Architecture

```
bin/draftwise.js              → CLI entry point (shebang, calls src/index.js)
src/index.js              → command router (dynamic imports, help)
src/commands/             → one file per CLI command, default export async fn
src/core/scanner.js       → codebase scanning (frameworks, routes, components, models)
src/ai/provider.js        → routes complete() calls to the right provider adapter
src/ai/providers/         → claude.js wired; openai.js + gemini.js stubbed
src/ai/prompts/           → one prompt module per command. Each exports brownfield + greenfield SYSTEM constants, a selectSystem(projectState) helper, a buildPrompt() that branches on projectState, and an agent-mode instruction
src/utils/                → config.js (yaml loader; returns projectState/stack/scanMaxFiles), specs.js (list .draftwise/specs/), slug.js, overview.js (read .draftwise/overview.md for greenfield context), scan-cache.js (fingerprinted scan cache, drop-in for scan()), flow-filter.js (narrow scan to flow-relevant items), scan-warnings.js (truncation + missing-framework messages), fs.js (shared pathExists), scan-projection.js (shared compactScan that trims a raw scan into a prompt-sized projection), tty.js (isInteractive helper), agent-handoff.js (shared orienting prefix logged before every agent-mode handoff)
test/                     → vitest, mirrors src structure
.claude-plugin/           → plugin marketplace declaration (see "Claude Code plugin" below)
plugin/                   → plugin source tree shipped via the marketplace
```

**Claude Code plugin.** Distributed separately from the npm package — `.claude-plugin/marketplace.json` at repo root declares a single `draftwise` plugin with `source: ./plugin`. Inside `plugin/` is `.claude-plugin/plugin.json` (the install manifest) and `skills/draft/SKILL.md` plus `skills/draft/reference/<verb>.md` per CLI verb. **Plugin name is `draftwise` (matches npm package + brand); skill name is `draftwise` (matches CLI binary), so the user-facing slash form is `/draftwise <verb>`** — same word in chat and terminal. Pattern follows impeccable's distribution model: one skill routes to per-verb references that drive the conversation in chat and shell out to the npm-installed `draftwise` CLI. Users install via `/plugin marketplace add 4nkur/draftwise` in Claude Code, then `/plugin install draftwise`. The plugin is *not* shipped on npm — `package.json` `files` excludes the plugin directories. References include pre-flight checks (e.g. `new` warns if `overview.md` is stale, `tech` nudges to skim the product spec first) and tone shaping for how to ask the user about ambiguous flag values; they explicitly inherit `src/ai/prompts/principles.js`'s collaboration standards so the chat-driven conversation matches what the CLI's api-mode synthesis enforces.

The single most important module is `src/core/scanner.js` — it parses the user's codebase and produces a structured representation everything else builds on. Get that right and the rest follows.

---

## Tech stack

- **Node.js >= 20**, ES modules (`"type": "module"` in package.json)
- **No framework** — lightweight CLI with dynamic imports for fast startup
- **vitest** for testing
- **eslint + prettier** for code style
- **YAML** for config (`yaml` package)
- **Markdown** for all spec documents
- **`@inquirer/prompts`** for interactive prompts (init's mode select, new's Q&A loop, tech/tasks spec picker) — strictly the TTY-only convenience layer; flags drive the canonical input path (see "How input works" below).
- **AI SDKs:** `@anthropic-ai/sdk` is wired up for Mode 2 (api). `openai` and `@google/generative-ai` are stubbed in `src/ai/provider.js` and throw a clear "not yet wired up" error — install + implement when needed. Agent mode (Mode 1) ships scanner data + an instruction string for the host agent to consume; no SDK call.

**On dependency pinning:** `@anthropic-ai/sdk` is pinned to an exact version because it's a 0.x package — semver doesn't promise that 0.91 → 0.92 stays non-breaking. `@inquirer/prompts` and `yaml` use caret ranges because they're stable 1.x+ packages where minor bumps follow semver. Dependabot (`.github/dependabot.yml`) opens PRs for both kinds; the asymmetry is intentional, not an oversight.

No TypeScript for v1 — keep it simple. May migrate later if the codebase grows.

---

## How AI fits in

Draftwise is fully AI-driven. Every meaningful command needs a model to do its work — the codebase scanner produces structured data, but interpreting that data into useful explanations and grounded specs requires an LLM. There are two ways the AI can be invoked:

**Mode 1: Inside a coding agent.** Draftwise runs as slash commands inside Claude Code, Cursor, Copilot, etc. The agent's existing model handles the reasoning. Draftwise provides prompts, templates, and the codebase context.

**Mode 2: Standalone with API key.** User configures an API key (Claude, OpenAI, or Gemini) during `draftwise init`. Draftwise calls the API directly.

Both modes share the same prompt templates and codebase scanning logic. The difference is just where the model call happens.

Configured in `.draftwise/config.yaml`:

```yaml
ai:
  mode: agent | api
  provider: claude | openai | gemini  # only if mode: api
  api_key_env: ANTHROPIC_API_KEY      # only if mode: api
  model: ""                            # optional override
  max_tokens: 16384                    # optional; default 16384. Bumped from 8192 because synthesis calls were truncating on big repos.
project:
  state: greenfield | brownfield      # set by `draftwise init`; controls prompt routing
  stack: "Next.js + Postgres + Prisma" # greenfield only; the stack the PM picked at init
scan:
  max_files: 5000                      # optional; raise for monorepos. Scanner emits a "truncated" warning when this is hit.
```

`loadConfig()` in `src/utils/config.js` defaults `project.state` to `brownfield` for back-compat with configs written before the greenfield routing landed.

---

## Key design principles

**Codebase is truth, specs are intent.** The codebase scan is the source of facts about the product. Specs describe what should change. When they disagree, the codebase wins.

**Product specs and technical specs are separate documents.** Never blend them. Product specs are jargon-free and readable by anyone on the team. Technical specs reference real files, endpoints, and schemas.

**The AI does homework before asking.** No spec command should write to disk before scanning relevant code. The reading-first principle is what makes Draftwise different from a template generator.

**Prompts are authoritative.** Each command's section structure lives in its prompt module under `src/ai/prompts/<command>.js` (a `SYSTEM` constant plus a `buildPrompt` function plus an agent-mode instruction). Don't hardcode structure inside command files — change the prompt instead.

**Conversation, not form-filling.** `draftwise new` should walk the user through questions, not present a blank form. The conversation is the value — it surfaces gaps the user wouldn't have noticed in a template.

**Flags drive input; inquirer is a TTY-only fallback.** Every command takes its full input set as flags (`--mode`, `--ai-mode`, `--idea`, `--answers @file.json`, `--force`, `--yes`, etc.) parsed via Node's built-in `util.parseArgs`. When stdin is a TTY and a required value is missing, inquirer fires to fill it in — that's the only place inquirer lives. When stdin is not a TTY (CI, coding-agent shell), most commands error with a specific usage hint instead of hanging on a prompt; `draftwise init` is special — when it can't proceed without asking the user something, it prints a structured **agent handoff** (questions in chat-friendly format + a re-invocation template, all under `AGENT_HANDOFF_PREFIX`) and exits cleanly, so the host coding agent reads stderr, asks the user in chat, and re-invokes with collected flags. Mode 1 (slash-command wrappers, issue #42) drives the conversation up in the host agent's chat and re-invokes the CLI with flags; the CLI itself becomes a non-conversational executor. TTY-detection helper in `src/utils/tty.js`; tests opt into either path via `deps.isInteractive`.

**Don't clobber hand-edits silently.** Specs are work product — PMs review and refine them after generation. Re-running `new`, `tech`, or `tasks` against an existing file (same slug, same target) prompts to confirm overwrite; `--force` skips the prompt for scripted use. Agent mode is exempt because the host coding agent does the write, not Draftwise. `scan` is also exempt — refreshing `overview.md` IS its purpose. The check is positioned *before* the synthesis API call (after the plan call in `new`, after target selection in `tech` / `tasks`) so a cancel doesn't burn tokens or waste user-typed answers.

**Opinionated about how the AI talks.** Draftwise injects a shared `CORE_PRINCIPLES` block into every conversational / drafting prompt: no filler, redirect drift, push back on weak ideas (don't repackage them as agreement), extend existing architecture before adding new pieces, flag bad assumptions and uncertain claims, offer the counter-case on strategic decisions. Source of truth: `src/ai/prompts/principles.js`. Change behavior there, not in each command's prompt.

**Opinionated about how the spec reads.** A second shared block — `SPEC_LANGUAGE_RULES` plus `EDGE_CASE_DISCIPLINE` — lives in `src/ai/prompts/spec-quality.js`. The language rules go into the synthesis SYSTEM constants for `new` and `tech` (specific over generic, active voice, same term every time, cut filler, examples for ambiguous claims, don't blame users, equal-effort sections). The edge-case discipline goes into `tech` only — it tells the model to name empty data, errors, loading, permissions, concurrency, and large-data behavior inline in each component / endpoint section. JSON-shaped calls (plan, questions, stacks) and `tasks` skip both because they aren't drafting prose. Same single-source-of-truth pattern as `principles.js` — change the rule there, not per command.

**Single repo, single feature spec at a time.** No cross-spec dependency tracking. No multi-repo. Keep scope tight.

---

## Commands

```
draftwise init                          → set up .draftwise/; routes to greenfield or brownfield flow
draftwise scaffold                      → create initial files from the greenfield plan (greenfield only)
draftwise scan                          → refresh the structured codebase overview (brownfield)
draftwise explain <flow>                → trace how a specific flow works in the actual code (brownfield)
draftwise new "<idea>" [--force]        → conversational drafting → product-spec.md
draftwise tech [<feature>] [--force]    → drafts technical-spec.md from approved product spec
draftwise tasks [<feature>] [--force]   → ordered tasks.md from technical spec
draftwise list                          → list all specs in .draftwise/specs/
draftwise show <feature> [type]         → display a spec (type: product | tech | tasks; default: product)
```

Each command is a separate file under `src/commands/` with a single `export default async function(args, deps = {}) {}`. The `deps` object is the dependency-injection seam used by tests — `cwd`, `log`, `scan`, `loadConfig`, `complete`, and per-command prompt overrides.

---

## What gets installed in the user's repo

```
.draftwise/
├── .gitignore                   # written by init; excludes .cache/ from version control
├── .cache/
│   └── scan.json                # fingerprinted scan cache (gitignored)
├── overview.md                  # codebase summary (brownfield) or greenfield plan
├── scaffold.json                # greenfield only: structured stack data for `draftwise scaffold`
├── flows/                       # `draftwise explain` snapshots (brownfield)
│   └── <flow-slug>.md
├── specs/
│   └── <feature-name>/
│       ├── product-spec.md      # what & why
│       ├── technical-spec.md    # how — grounded in real code (or marked "(new)" for greenfield)
│       └── tasks.md             # ordered implementation breakdown
└── config.yaml                  # AI provider + project state + chosen stack
```

---

## v1 status — all commands shipped

The build order below was the original sequence. As of `0.1.5` published to npm, every command is implemented end-to-end with both AI modes (agent + api) and a vitest test suite (~240 tests). The original `0.0.1` cut shipped the command surface; `0.1.0` added greenfield support and Python scanner; `0.1.5` added overwrite protection, live token streaming, and a richer set of drafting / spec-quality prompt rules.

1. **`init`** ✅ — asks the user about project state (greenfield vs brownfield) and AI mode, then routes:
   - **Brownfield path:** scans the codebase, writes `.draftwise/specs/`, `overview.md` placeholder, `config.yaml` (with `project.state: brownfield`).
   - **Greenfield path:** prompts for the idea, then in **api mode** generates clarifying questions → captures answers → proposes 2-3 stack options with rationale/pros/cons/directory structure/setup commands → writes a full greenfield plan to `overview.md` + `config.yaml` (with `project.state: greenfield` and the chosen `stack`). In **agent mode**, prints a 3-phase instruction for the host coding agent to walk the conversation and rewrite `overview.md`.
   Refuses if `.draftwise/` already exists. (`src/commands/init.js`, prompts in `src/ai/prompts/greenfield.js`)

2. **`scan`** ✅ — brownfield: runs the scanner and (api) calls the model to produce a narrated `overview.md`, or (agent) dumps scanner data + an instruction for the host agent. Greenfield: short-circuits with a friendly "no code yet" message — `overview.md` is the greenfield plan from `init`. (`src/commands/scan.js`)

3. **`explain <flow>`** ✅ — brownfield: traces a single flow end-to-end. Greenfield: short-circuits with a friendly message (no flows to trace yet). (`src/commands/explain.js`)

4. **`new "<idea>"`** ✅ — brownfield: three-phase conversational drafting (AI plan call returns JSON with affected_flows / clarifying_questions / adjacent_opportunities → inquirer Q&A + accept/decline loop → AI synthesis call → `product-spec.md`). Greenfield: skips the scanner and reads `overview.md` (the project plan from `init`); plan call returns clarifying questions only (no affected_flows / adjacent_opportunities — there's nothing existing to integrate with); synthesis writes a spec without "Affected flows" / "Adjacent changes" sections. Hard rule shared across both modes: never assume — turn every gap into a question. (`src/commands/new.js`, prompts in `src/ai/prompts/new.js` with `selectPlanSystem` / `selectSpecSystem`)

5. **`tech [<feature>]`** ✅ — brownfield: reads `product-spec.md`, drafts `technical-spec.md` grounded in scanner output. Greenfield: skips scanner, reads `overview.md` (the project plan), drafts `technical-spec.md` with every file path marked `(new)` and the chosen stack's conventions. (`src/commands/tech.js`, `src/ai/prompts/tech.js` with `selectSystem`)

6. **`tasks [<feature>]`** ✅ — brownfield: reads `technical-spec.md`, drafts ordered `tasks.md` (Goal / Files / Depends on / Parallel with / Acceptance). Greenfield: reads the project plan + technical spec, drafts `tasks.md` where files are all `(new)` and the first 1-3 tasks are foundational scaffolding (run setup commands, install deps, configure env). (`src/commands/tasks.js`, `src/ai/prompts/tasks.js` with `selectSystem`)

7. **`list` and `show <feature> [type]`** ✅ — file-system utilities, no AI. (`src/commands/list.js`, `src/commands/show.js`)

8. **`scaffold`** ✅ — greenfield-only file scaffolder. Reads `.draftwise/scaffold.json` (written by `init` in greenfield + api mode, or by the host agent in greenfield + agent mode), confirms with the user — including a warning that scaffolders like `create-next-app` should run first — then creates each `initial_files` entry with placeholder content (skipping any that already exist). Prints the `setup_commands` as a reminder; doesn't run them. (`src/commands/scaffold.js`)

---

## The codebase scanner — the heart of Draftwise

`src/core/scanner.js` is the most important module. Everything else is downstream of it. If the scanner is unreliable or shallow, Draftwise produces generic specs and bad explanations. If it's accurate and structured, every other command lights up.

### What it should detect (v1)

- **Routes / endpoints** — Express, Fastify, Next.js (start with these, expand later)
- **Components** — React, Vue, Svelte, file-level for v1 (don't try to parse internal symbols yet)
- **Data models** — Prisma, SQLAlchemy, Mongoose, Sequelize, Drizzle
- **Entry points and main flows** — heuristics: most-imported files, route handlers, top-level services
- **File-to-feature mapping** — group by directory + naming conventions

### Output format

A structured JSON-ish object that any command can consume:

```js
{
  routes: [{ path: '/api/albums', methods: ['GET', 'POST'], file: 'src/api/albums.ts' }],
  components: [{ name: 'AlbumGrid', file: 'src/components/AlbumGrid.tsx' }],
  models: [{ name: 'Album', file: 'prisma/schema.prisma', fields: [...] }],
  flows: [{ name: 'photo-albums', files: [...], summary: '...' }]
}
```

### Languages and frameworks

**Currently supported:**
- **JS/TS:** Next.js (pages + app router), Express, Fastify, Hapi, Koa, NestJS, Vue, Svelte, SvelteKit, Nuxt, Remix, React Router. ORMs: Prisma, Mongoose, Sequelize, Drizzle, TypeORM, Knex.
- **Python:** FastAPI, Starlette, Flask, Django, Tornado. ORMs: SQLAlchemy, Django ORM, Peewee, Tortoise ORM. Reads `requirements.txt` and `pyproject.toml` (PEP 621 + Poetry tables).

**Planned expansions:** Go (net/http, Gin, Echo, Chi + GORM, Ent), Rust (Axum, Actix, Rocket + Diesel, sqlx), mobile codebases (React Native, Swift, Kotlin).

Don't try to make v1 universal. A great experience for JS/TS is better than a mediocre experience for everything.

---

## Conventions

- **File per command.** `src/commands/<name>.js` with `export default async function(args, deps = {}) {}`. The `deps` argument is how tests inject `cwd`, `log`, `scan`, `loadConfig`, `complete`, and prompts.
- **Async/await everywhere.** No `.then()` chains.
- **Console output for CLI feedback.** Plain text for now — colored output (kleur/chalk) is deferred until there's a need.
- **Errors bubble up to `src/index.js`.** It catches and prints a friendly message, then exits non-zero.
- **Test file naming:** `test/commands/<name>.test.js` tests `src/commands/<name>.js`. Other module tests mirror the source path (`test/utils/config.test.js`, `test/ai/new.test.js`, etc.).
- **AI prompts in `src/ai/prompts/<command>.js`.** Each module exports a `SYSTEM` constant, one or more `buildPrompt` functions, and an agent-mode instruction string. Iterate the prompt here, not inside the command.
- **No real network calls in tests.** Inject `complete` in deps and return a canned model response. Tests run in a temp dir, never the project's `.draftwise/`.

---

## Commands to know during development

```bash
npm test                # vitest run
npm run test:watch      # vitest watch
npm run lint            # eslint src/ test/
npm run format          # prettier --write
node bin/draftwise.js   # run CLI locally
npm link                # install CLI globally from this repo
```

---

## Scope boundaries

### In v1

- Single-repo only
- Single-author per spec (no real-time collab)
- Codebase scan refreshes on demand (no live watching)
- AI mode: agent or API key, configured at init

### Deferred for later

These are valuable ideas, but they belong in a future version — keep them out of v1 to avoid scope creep:

- **Multi-repo support.** Specs spanning frontend, backend, mobile in separate repos.
- **Living documentation system.** Specs that update automatically as the product evolves, with a changelog.
- **Business stakeholder review workflows.** Inline commenting, approval flows, GitHub Pages publishing.
- **Persistent memory across sessions.** A knowledge graph that remembers reviewer routing, terminology, and conventions over time.
- **Drift detection.** Comparing specs against the codebase and flagging when they've diverged.
- **Cross-spec dependency analysis.** Finding overlaps between in-flight specs.
- **PR orchestration.** Opening PRs in linked repos, coordinating merges across services.
- **Brownfield import.** Reading existing specs from Google Drive, Notion, Confluence as context.

When a contributor proposes one of these, gently redirect — they're worth doing, but not now.

---

## Existing tools to study (for inspiration, not copying)

- **OpenSpec** (github.com/Fission-AI/OpenSpec) — well-scoped CLI for spec workflows. Good prior art on lightweight markdown + YAML structure.
- **Spec Kit** (github.com/github/spec-kit) — opinionated spec-driven development phases. Useful for thinking about lifecycle, even though Draftwise is much narrower.
- **Aider** — codebase-aware AI coding tool. Strong reference for repo scanning and providing context to LLMs at the CLI level.

---

## Open questions

Real, currently-open questions only. Resolved decisions move to **Past decisions** below.

1. **Default model.** `claude-sonnet-4-6` hardcoded in `src/ai/providers/claude.js` as the default; users can override via `ai.model` in `config.yaml`. Reasonable for now; revisit when Anthropic ships a successor or a noticeably better trade-off model lands.
2. **OpenAI / Gemini adapters.** Stubbed with a clear error in `src/ai/provider.js`. Wire up when a user asks for them; structure mirrors `claude.js`.
3. **Scanner language coverage — Go and Rust.** Same shape as the Python expansion. Go: net/http, Gin, Echo, Chi + GORM, Ent. Rust: Axum, Actix, Rocket + Diesel, sqlx.
4. **AI-assisted spec merge mode.** Today, re-running `new` / `tech` / `tasks` on an existing spec offers Overwrite or Cancel — both blunt. The richer behavior is a "refine" mode where the model reads the existing file, identifies user edits, and returns a unified spec that preserves them. Different shape of API call (refine vs synthesize) and a real feature, not polish. Defer until there's user demand; the `--force` / cancel default is the safe baseline in the meantime.

## Past decisions

Resolved questions kept here as a quick map from "why is X like this?" to the implementation. Use this when revisiting the design.

- **Scan depth (file cap).** Scanner caps at `DEFAULT_MAX_FILES` (5000) by default; raise via `scan.max_files` in `config.yaml`. Cap hits set `truncated: true` and surface a warning. → `src/core/scanner.js`, `src/utils/scan-warnings.js`.
- **Scan caching.** Fingerprinted (file path + mtime, hashed with `maxFiles`) cache at `.draftwise/.cache/scan.json`. Auto-invalidates on file change or `scan.max_files` bump. Init writes a `.draftwise/.gitignore` excluding `.cache/`. → `src/utils/scan-cache.js`.
- **Large flow tracing.** `filterScanForFlow(scan, flow)` tokenizes the flow name and narrows routes/components/models; per-category fallback to unfiltered if filtering wipes a previously non-empty list. `explain` always runs scans through the filter. → `src/utils/flow-filter.js`, `src/commands/explain.js`.
- **Unsupported framework warning.** `init` and `scan` log an explicit "no framework detected" hint listing what's supported when `frameworks` is empty. → `src/utils/scan-warnings.js`.
- **Scanner language coverage — Python.** Detects FastAPI / Starlette / Flask / Django / Tornado from `requirements.txt` or `pyproject.toml` (PEP 621 + Poetry); parses FastAPI / Flask decorator routes and Django `urls.py` `path(...)` / `re_path(...)`; parses SQLAlchemy and Django ORM models. Test files (`tests/`, `test_*.py`, `_test.py`, `conftest.py`) excluded from route detection. → `src/core/scanner.js` (Python sections).