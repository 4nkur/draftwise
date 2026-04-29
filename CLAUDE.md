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
bin/draftwise.js          → CLI entry point (shebang, calls src/index.js)
src/index.js              → command router (dynamic imports, help)
src/commands/             → one file per CLI command, default export async fn
src/core/scanner.js       → codebase scanning (frameworks, routes, components, models)
src/ai/prompts/           → one prompt module per command. Each exports a `buildAgentInstruction(...)` (or `AGENT_INSTRUCTION` constant for `scan`) that the host coding agent reads — section structure, hard rules, save path. No SDK call from the CLI; the agent does the synthesis.
src/utils/                → config.js (yaml loader; returns projectState/stack/scanMaxFiles), specs.js (list .draftwise/specs/), slug.js, overview.js (read .draftwise/overview.md for greenfield context), scan-cache.js (fingerprinted scan cache, drop-in for scan()), flow-filter.js (narrow scan to flow-relevant items), scan-warnings.js (truncation + missing-framework messages), fs.js (shared pathExists), scan-projection.js (shared compactScan that trims a raw scan into a prompt-sized projection), scan-context.js (shared greenfield/brownfield branch for new/tech/tasks), draftwise-dir.js (`requireDraftwiseDir` guard), agent-handoff.js (shared orienting prefix logged before every agent-mode handoff), project-state.js (filesystem auto-detect for `init` — bail-fast walk for source files using scanner's IGNORE_DIRS + CODE_EXTENSIONS), skill-providers.js (provider dir mapping + Claude-only frontmatter trim + `detectInstalledProviders` filesystem check shared across `skills install` / `uninstall` / `help`)
test/                     → vitest, mirrors src structure
.claude-plugin/           → plugin marketplace declaration (see "Claude Code plugin" below)
plugin/                   → plugin source tree shipped via the marketplace
```

**Claude Code skill — two install paths, three harnesses on the standalone path.** `.claude-plugin/marketplace.json` at repo root declares a single `draftwise` plugin with `source: ./plugin`. Inside `plugin/` is `.claude-plugin/plugin.json` (the install manifest) and `skills/draftwise/SKILL.md` plus `skills/draftwise/reference/<verb>.md` per CLI verb. The same SKILL.md ships through two install paths with different slash-command shapes:

- **Marketplace plugin** (`/plugin marketplace add 4nkur/draftwise` then `/plugin install draftwise`): Claude Code namespaces all plugin skills as `<plugin>:<skill>`, so the chat form is `/draftwise:draftwise <verb>`. The namespace prefix is mandatory for plugin-installed skills regardless of `/plugin install` scope (user / project / project-this-user) — see [anthropics/claude-code#15882](https://github.com/anthropics/claude-code/issues/15882) (closed: not planned). Claude Code only.
- **Standalone skill** (`draftwise skills install`): writes the same SKILL.md into each known harness's user-level skill dir (`~/.claude/skills/draftwise/`, `~/.cursor/skills/draftwise/`, `~/.gemini/skills/draftwise/`). No plugin manifest sits alongside it, so each harness reads it as a regular user skill — bare `/draftwise <verb>`, matching the CLI binary. **Default is auto-detect:** with no `--provider` flag, `detectInstalledProviders` checks which of `~/.claude` / `~/.cursor` / `~/.gemini` exist at the chosen scope root and installs only to those. `--provider=all` forces install everywhere regardless of detection (the old default); `--provider=<name>` targets one harness regardless of detection; `--scope=project` writes under `<cwd>` instead of `~`. When auto-detect finds nothing, the command errors with a hint pointing at `--provider=all` / `--provider=<name>`. `skills uninstall` keeps its "remove from every known dir, skip empty" behavior — different goal (clean up stale Draftwise installs whether or not the harness is still present), so detection-on-uninstall would miss the cleanup case. Per-provider frontmatter trim in `src/utils/skill-providers.js` strips Claude-only fields (`user-invocable`, `argument-hint`, `allowed-tools`) for non-Claude harnesses; body is identical.

Pattern: one skill routes to per-verb references that drive the conversation in chat and shell out to the npm-installed `draftwise` CLI. The two install paths are independent and may coexist (you'll see both `/draftwise:draftwise <verb>` and `/draftwise <verb>` listed in Claude Code). `package.json` `files` ships `plugin/skills/` (so the standalone install can copy from `node_modules/draftwise/plugin/skills/draftwise/`) but excludes `plugin/.claude-plugin/`. References include pre-flight checks (e.g. `new` warns if `overview.md` is stale, `tech` nudges to skim the product spec first) and tone shaping for how to ask the user about ambiguous flag values. The `skills` subcommand group lives at `src/commands/skills/{install,uninstall,help}.js`; routing in `src/index.js` follows the `git remote <sub>` / `gh pr <sub>` pattern via `SUBCOMMAND_GROUPS`.

The single most important module is `src/core/scanner.js` — it parses the user's codebase and produces a structured representation everything else builds on. Get that right and the rest follows.

---

## Tech stack

- **Node.js >= 20**, ES modules (`"type": "module"` in package.json)
- **No framework** — lightweight CLI with dynamic imports for fast startup
- **vitest** for testing
- **eslint + prettier** for code style
- **YAML** for config (`yaml` package)
- **Markdown** for all spec documents
- **No interactive prompts.** Every command takes its input via flags or positional args. Missing required input → error with a usage hint, or (for `draftwise init` greenfield without `--idea`) a structured agent handoff. No `@inquirer/prompts`, no `node:readline` — the CLI never blocks on stdin.
- **No AI SDK.** Draftwise doesn't call models from the CLI. Every command prints scanner data plus an instruction for the host coding agent (Claude Code, Cursor, Gemini CLI, etc.), which does the synthesis using its own model.

**On dependency pinning:** `yaml` uses a caret range because it's a stable 2.x package where minor bumps follow semver. Dependabot (`.github/dependabot.yml`) opens PRs for it.

No TypeScript for v1 — keep it simple. May migrate later if the codebase grows.

---

## How AI fits in

Draftwise runs as slash commands inside a coding agent (Claude Code, Cursor, Gemini CLI, Copilot, etc.). The CLI scans the codebase, prints structured scanner data plus an instruction, and exits — the host agent's model does the synthesis and writes the spec back to disk. The CLI never calls a model itself; there is no SDK dependency.

Configured in `.draftwise/config.yaml`:

```yaml
project:
  state: greenfield | brownfield      # set by `draftwise init`; controls prompt routing
  stack: "Next.js + Postgres + Prisma" # greenfield only; the stack the PM picked at init
scan:
  max_files: 5000                      # optional; raise for monorepos. Scanner emits a "truncated" warning when this is hit.
```

`loadConfig()` in `src/utils/config.js` defaults `project.state` to `brownfield` for back-compat with configs written before the greenfield routing landed. Configs written before api mode was dropped may carry an `ai:` block — `loadConfig` prints a one-line notice telling the user the block is safe to delete, then ignores it.

---

## Key design principles

**Codebase is truth, specs are intent.** The codebase scan is the source of facts about the product. Specs describe what should change. When they disagree, the codebase wins.

**Product specs and technical specs are separate documents.** Never blend them. Product specs are jargon-free and readable by anyone on the team. Technical specs reference real files, endpoints, and schemas.

**The AI does homework before asking.** No spec command should write to disk before scanning relevant code. The reading-first principle is what makes Draftwise different from a template generator.

**Prompts are authoritative.** Each command's section structure lives in its prompt module under `src/ai/prompts/<command>.js` (a `buildAgentInstruction(...)` function — or `AGENT_INSTRUCTION` constant for `scan` — that the host agent reads). Don't hardcode structure inside command files — change the prompt instead.

**Conversation lives in the host agent.** The CLI is a non-conversational executor: it loads context (scanner data or greenfield plan), prints an instruction, and exits. The host coding agent walks the PM through clarifying questions in chat, then writes the spec to disk. `draftwise new` doesn't run a Q&A loop from the CLI itself — its instruction tells the agent to.

**Flags drive input; no interactive prompts.** Every command takes its full input set as flags (`--mode`, `--idea`, `--yes`) or positional args, parsed via Node's built-in `util.parseArgs`. Missing required input errors with a specific usage hint — the CLI never blocks waiting for stdin. `draftwise init` is the one special case: greenfield without `--idea` prints a structured **agent handoff** (the question in chat-friendly format + a re-invocation template, all under `AGENT_HANDOFF_PREFIX`) and exits cleanly, so the host coding agent reads stderr, asks the user in chat, and re-invokes with the collected flag. A plain-terminal user reads the same handoff as a usage hint.

**Single repo, single feature spec at a time.** No cross-spec dependency tracking. No multi-repo. Keep scope tight.

---

## Commands

```
draftwise init                          → set up .draftwise/; auto-detects new vs existing project (override with --mode=)
draftwise scaffold                      → create initial files from the greenfield plan (greenfield only)
draftwise scan                          → refresh the structured codebase overview (brownfield)
draftwise explain <flow>                → trace how a specific flow works in the actual code (brownfield)
draftwise new "<idea>"                  → conversational drafting → product-spec.md (host agent writes)
draftwise tech [<feature>]              → technical-spec.md from approved product spec (host agent writes)
draftwise tasks [<feature>]             → ordered tasks.md from technical spec (host agent writes)
draftwise list                          → list all specs in .draftwise/specs/
draftwise show <feature> [type]         → display a spec (type: product | tech | tasks; default: product)
draftwise skills install [--provider=...] [--scope=...] [--force]   → install standalone skill across harnesses (Claude Code / Cursor / Gemini CLI; bare /draftwise <verb>)
draftwise skills uninstall [--provider=...] [--scope=...]           → remove standalone skill installs
draftwise skills help                                                → list known harnesses + install state
```

Each command is a separate file under `src/commands/` with a single `export default async function(args, deps = {}) {}`. The `deps` object is the dependency-injection seam used by tests — `cwd`, `log`, `scan`, `loadConfig`, `readOverview`, `listSpecs`, etc.

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
└── config.yaml                  # project state + chosen stack
```

---

## v1 status — all commands shipped

Every command is implemented end-to-end and exercised by a vitest suite. The original `0.0.1` cut shipped the command surface; `0.1.0` added greenfield support and Python scanner; `0.1.5` added overwrite protection and richer drafting prompt rules; `0.2.x` shipped the Claude Code plugin and standalone skill installer; the [Unreleased] cut drops api mode, leaving the CLI as a pure executor that hands off to the host coding agent.

1. **`init`** ✅ — auto-detects project state from the filesystem (zero source files → greenfield; otherwise brownfield, using scanner.js's `IGNORE_DIRS` + `CODE_EXTENSIONS`), then routes:
   - **Brownfield path:** scans the codebase, writes `.draftwise/specs/`, `overview.md` placeholder, `config.yaml` (with `project.state: brownfield`). No questions asked.
   - **Greenfield path:** needs `--idea`. Writes `config.yaml` (with `project.state: greenfield`), `overview.md` placeholder, and prints a 3-phase instruction for the host coding agent to walk the stack-selection conversation and rewrite `overview.md` plus `scaffold.json`.
   `--mode=greenfield|brownfield` overrides the auto-detection (canonical flag values; user-facing copy uses "new project" / "existing codebase" instead). Refuses if `.draftwise/` already exists. Detection lives in `src/utils/project-state.js`. (`src/commands/init.js`, prompt in `src/ai/prompts/greenfield.js`)

2. **`scan`** ✅ — brownfield: runs the scanner, prints scanner data + an instruction for the host agent to write a narrated `overview.md`. Greenfield: short-circuits with a friendly "no code yet" message — `overview.md` is the greenfield plan from `init`. (`src/commands/scan.js`)

3. **`explain <flow>`** ✅ — brownfield: filters scanner output to flow-keyword-relevant items, prints them plus an instruction for the host agent to write `.draftwise/flows/<slug>.md`. Greenfield: short-circuits with a friendly message (no flows to trace yet). (`src/commands/explain.js`)

4. **`new "<idea>"`** ✅ — brownfield: prints scanner data + the idea + a 3-phase instruction (plan / Q&A / synthesis) for the host agent to walk the conversation and write `product-spec.md`. Greenfield: skips the scanner and reads `overview.md` (the project plan from `init`); the instruction tells the agent to ask clarifying questions only (no affected_flows / adjacent_opportunities) and write a spec without "Affected flows" / "Adjacent changes" sections. (`src/commands/new.js`, prompt in `src/ai/prompts/new.js`)

5. **`tech [<feature>]`** ✅ — reads `product-spec.md`, prints it plus scanner output (brownfield) or the project plan (greenfield) plus an instruction for the host agent to write `technical-spec.md`. Greenfield marks every file path `(new)` and uses the chosen stack's conventions. (`src/commands/tech.js`, prompt in `src/ai/prompts/tech.js`)

6. **`tasks [<feature>]`** ✅ — reads `technical-spec.md`, prints it plus scanner output (brownfield) or the project plan (greenfield) plus an instruction for the host agent to write ordered `tasks.md` (Goal / Files / Depends on / Parallel with / Acceptance). Greenfield front-loads 1-3 scaffolding tasks. (`src/commands/tasks.js`, prompt in `src/ai/prompts/tasks.js`)

7. **`list` and `show <feature> [type]`** ✅ — file-system utilities, no AI. (`src/commands/list.js`, `src/commands/show.js`)

8. **`scaffold`** ✅ — greenfield-only file scaffolder. Reads `.draftwise/scaffold.json` (written by the host coding agent during init's greenfield handoff), confirms with the user — including a warning that scaffolders like `create-next-app` should run first — then creates each `initial_files` entry with placeholder content (skipping any that already exist). Prints the `setup_commands` as a reminder; doesn't run them. (`src/commands/scaffold.js`)

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

- **File per command.** `src/commands/<name>.js` with `export default async function(args, deps = {}) {}`. The `deps` argument is how tests inject `cwd`, `log`, `scan`, `loadConfig`, `readOverview`, `listSpecs`, etc.
- **Async/await everywhere.** No `.then()` chains.
- **Console output for CLI feedback.** Plain text for now — colored output (kleur/chalk) is deferred until there's a need.
- **Errors bubble up to `src/index.js`.** It catches and prints a friendly message, then exits non-zero.
- **Test file naming:** `test/commands/<name>.test.js` tests `src/commands/<name>.js`. Other module tests mirror the source path (`test/utils/config.test.js`, etc.).
- **AI prompts in `src/ai/prompts/<command>.js`.** Each module exports a `buildAgentInstruction(...)` (or `AGENT_INSTRUCTION` constant for `scan`) — section structure, hard rules, and the save path the host agent should write to. Iterate the prompt here, not inside the command.
- **No network calls anywhere.** The CLI doesn't talk to model APIs; tests run in a temp dir, never the project's `.draftwise/`.

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
- Agent-mode only — Draftwise runs inside a coding agent (Claude Code, Cursor, Gemini CLI, etc.); the agent's model does the synthesis

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

1. **Re-add api mode (standalone with API key).** Dropped in [Unreleased] — the CLI now runs only inside coding agents. Bringing it back means re-introducing an SDK dependency, the `ai:` config block, the per-command synthesis branch, and the `--force` / `--answers` flags that supported it. Worth doing if standalone-CLI usage becomes a real demand; until then, every command is simpler and the SDK surface is gone. Reference: the dropped surface is recoverable from git history (`drop-api-mode` PR).
2. **Scanner language coverage — Go and Rust.** Same shape as the Python expansion. Go: net/http, Gin, Echo, Chi + GORM, Ent. Rust: Axum, Actix, Rocket + Diesel, sqlx.

## Past decisions

Resolved questions kept here as a quick map from "why is X like this?" to the implementation. Use this when revisiting the design.

- **Scan depth (file cap).** Scanner caps at `DEFAULT_MAX_FILES` (5000) by default; raise via `scan.max_files` in `config.yaml`. Cap hits set `truncated: true` and surface a warning. → `src/core/scanner.js`, `src/utils/scan-warnings.js`.
- **Scan caching.** Fingerprinted (file path + mtime, hashed with `maxFiles`) cache at `.draftwise/.cache/scan.json`. Auto-invalidates on file change or `scan.max_files` bump. Init writes a `.draftwise/.gitignore` excluding `.cache/`. → `src/utils/scan-cache.js`.
- **Large flow tracing.** `filterScanForFlow(scan, flow)` tokenizes the flow name and narrows routes/components/models; per-category fallback to unfiltered if filtering wipes a previously non-empty list. `explain` always runs scans through the filter. → `src/utils/flow-filter.js`, `src/commands/explain.js`.
- **Unsupported framework warning.** `init` and `scan` log an explicit "no framework detected" hint listing what's supported when `frameworks` is empty. → `src/utils/scan-warnings.js`.
- **Scanner language coverage — Python.** Detects FastAPI / Starlette / Flask / Django / Tornado from `requirements.txt` or `pyproject.toml` (PEP 621 + Poetry); parses FastAPI / Flask decorator routes and Django `urls.py` `path(...)` / `re_path(...)`; parses SQLAlchemy and Django ORM models. Test files (`tests/`, `test_*.py`, `_test.py`, `conftest.py`) excluded from route detection. → `src/core/scanner.js` (Python sections).