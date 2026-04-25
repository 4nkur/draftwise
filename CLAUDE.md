# CLAUDE.md

Context for Claude Code when working on this repo.

---

## What we're building

Draftwise is a codebase-aware product spec drafting tool. It makes a team's codebase legible — explaining what already exists, tracing how specific flows work today — and drafts product and technical specs that fit the real code.

The three primary jobs Draftwise does:

1. **Explains the product back to its team.** New PMs use it to onboard. Existing PMs use it to verify their mental model before drafting.
2. **Traces current behavior.** Walk through how a specific flow actually works in the codebase, end to end.
3. **Drafts grounded specs.** When a PM proposes a new feature, the spec references real components, real endpoints, real schemas — not generic placeholders.

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
src/ai/provider.js        → routes complete() calls to the right provider adapter
src/ai/providers/         → claude.js wired; openai.js + gemini.js stubbed
src/ai/prompts/           → one prompt module per command (system + buildPrompt + agent instruction)
src/utils/                → config.js (yaml loader), specs.js (list .draftwise/specs/), slug.js
test/                     → vitest, mirrors src structure
```

The single most important module is `src/core/scanner.js` — it parses the user's codebase and produces a structured representation everything else builds on. Get that right and the rest follows.

---

## Tech stack

- **Node.js >= 20**, ES modules (`"type": "module"` in package.json)
- **No framework** — lightweight CLI with dynamic imports for fast startup
- **vitest** for testing
- **eslint + prettier** for code style
- **YAML** for config (`yaml` package)
- **Markdown** for all spec documents
- **`@inquirer/prompts`** for interactive prompts (init's mode select, new's Q&A loop, tech/tasks spec picker)
- **AI SDKs:** `@anthropic-ai/sdk` is wired up for Mode 2 (api). `openai` and `@google/generative-ai` are stubbed in `src/ai/provider.js` and throw a clear "not yet wired up" error — install + implement when needed. Agent mode (Mode 1) ships scanner data + an instruction string for the host agent to consume; no SDK call.

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
  model: ""                            # optional override
```

---

## Key design principles

**Codebase is truth, specs are intent.** The codebase scan is the source of facts about the product. Specs describe what should change. When they disagree, the codebase wins.

**Product specs and technical specs are separate documents.** Never blend them. Product specs are jargon-free and readable by anyone on the team. Technical specs reference real files, endpoints, and schemas.

**The AI does homework before asking.** No spec command should write to disk before scanning relevant code. The reading-first principle is what makes Draftwise different from a template generator.

**Prompts are authoritative.** Each command's section structure lives in its prompt module under `src/ai/prompts/<command>.js` (a `SYSTEM` constant plus a `buildPrompt` function plus an agent-mode instruction). Don't hardcode structure inside command files — change the prompt instead.

**Conversation, not form-filling.** `draftwise new` should walk the user through questions, not present a blank form. The conversation is the value — it surfaces gaps the user wouldn't have noticed in a template.

**Single repo, single feature spec at a time.** No cross-spec dependency tracking. No multi-repo. Keep scope tight.

---

## Commands

```
draftwise init                          → scan codebase, set up .draftwise/, generate overview.md
draftwise scan                          → refresh the structured codebase overview
draftwise explain <flow>                → trace how a specific flow works in the actual code
draftwise new "<idea>"                  → conversational drafting → product-spec.md
draftwise tech [<feature>]              → drafts technical-spec.md from approved product spec
draftwise tasks [<feature>]             → ordered tasks.md from technical spec
draftwise list                          → list all specs in .draftwise/specs/
draftwise show <feature> [type]         → display a spec (type: product | tech | tasks; default: product)
```

Each command is a separate file under `src/commands/` with a single `export default async function(args, deps = {}) {}`. The `deps` object is the dependency-injection seam used by tests — `cwd`, `log`, `scan`, `loadConfig`, `complete`, and per-command prompt overrides.

---

## What gets installed in the user's repo

```
.draftwise/
├── overview.md                  # codebase summary — flows, surfaces, data, components
├── specs/
│   └── <feature-name>/
│       ├── product-spec.md      # what & why
│       ├── technical-spec.md    # how — grounded in real code
│       └── tasks.md             # ordered implementation breakdown
└── config.yaml                  # AI provider, scan settings, template prefs
```

---

## v1 status — all commands shipped

The build order below was the original sequence. As of `0.0.1` published to npm, every command is implemented end-to-end with both AI modes (agent + api) and a vitest test suite (~70 tests). The next published version will be `0.1.0` after end-to-end smoke testing.

1. **`init`** ✅ — creates `.draftwise/` skeleton, asks for AI mode, scans codebase, writes `overview.md` placeholder + `config.yaml`. Refuses if `.draftwise/` already exists. (`src/commands/init.js`)

2. **`scan`** ✅ — runs the scanner and (api mode) calls the model to produce a narrated `overview.md`, or (agent mode) dumps scanner data + an instruction for the host agent. (`src/commands/scan.js`)

3. **`explain <flow>`** ✅ — traces a single flow end-to-end. Saves a snapshot to `.draftwise/flows/<slug>.md` in api mode. (`src/commands/explain.js`)

4. **`new "<idea>"`** ✅ — three-phase conversational drafting: AI plan call (returns JSON with affected_flows, clarifying_questions, adjacent_opportunities) → inquirer Q&A + accept/decline loop → AI synthesis call → `product-spec.md`. Hard rule: never assume — turn every gap into a question. (`src/commands/new.js`)

5. **`tech [<feature>]`** ✅ — reads product-spec.md, drafts technical-spec.md grounded in scanner output. Auto-picks if one feature, prompts to choose if multiple. (`src/commands/tech.js`)

6. **`tasks [<feature>]`** ✅ — reads technical-spec.md, drafts ordered tasks.md (each with Goal, Files, Depends on, Parallel with, Acceptance). (`src/commands/tasks.js`)

7. **`list` and `show <feature> [type]`** ✅ — file-system utilities, no AI. (`src/commands/list.js`, `src/commands/show.js`)

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

**v1 supports:** JS/TS Node projects (Express, Next.js), common ORM patterns.

**v2+ ambitions:** Python (FastAPI, Django), Rust, Go, mobile codebases (React Native, Swift, Kotlin).

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

## Open questions (post-v1)

Some originals have been answered by implementation; the remaining ones are real and worth revisiting before `0.1.0`:

1. **Scan depth.** Today the scanner walks the whole tree (skipping `node_modules`/build dirs/dotfiles) and skips files >200KB during route-regex scanning. No hard file cap. May need one for monorepos.
2. **Scan caching.** Today every command re-runs the scanner — no caching, no incremental updates. Cheap enough for now but a bottleneck on huge repos.
3. **Default model.** `claude-sonnet-4-6` is hardcoded in `src/ai/providers/claude.js` as the default; users can override via `ai.model` in `config.yaml`. Reasonable for now.
4. **Large flow tracing.** `explain` sends the full scanner output to the model regardless of flow size. May need flow-aware filtering (only include relevant files) for very large flows.
5. **Unsupported frameworks.** Scanner returns empty arrays for routes/components/models when nothing matches — graceful but silent. Should it warn the user explicitly?
6. **OpenAI / Gemini adapters.** Stubbed with a clear error in `src/ai/provider.js`. Wire up when a user asks for them.