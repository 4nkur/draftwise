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
src/index.js              → command router (dynamic imports, help, version)
src/commands/             → one file per CLI command, default export async fn
src/core/                 → codebase scanning, spec generation, file management
src/ai/                   → AI provider adapters and prompts
src/templates/            → product-spec.md, technical-spec.md, config.yaml
src/utils/                → shared helpers (markdown, yaml, file system)
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
- **AI SDKs:** `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` for direct API mode; agent integrations via slash commands and the Agent Skills standard

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

**Templates are authoritative.** `src/templates/product-spec.md` and `src/templates/technical-spec.md` define structure. Don't hardcode structure inside command files.

**Conversation, not form-filling.** `draftwise new` should walk the user through questions, not present a blank form. The conversation is the value — it surfaces gaps the user wouldn't have noticed in a template.

**Single repo, single feature spec at a time.** No cross-spec dependency tracking. No multi-repo. Keep scope tight.

---

## Commands

```
draftwise init                  → scan codebase, set up .draftwise/, generate overview.md
draftwise scan                  → show structured product overview (refresh + display)
draftwise explain <flow>        → trace how a specific flow works in the actual code
draftwise new "<idea>"          → conversational drafting → product-spec.md
draftwise tech                  → drafts technical-spec.md from approved product spec
draftwise tasks                 → generates tasks.md from technical spec
draftwise list                  → list all specs in the repo
draftwise show <n>              → display a specific spec
```

Each command is a separate file under `src/commands/` with a single `export default async function(args) {}`.

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

## Build order for v1

Work through this sequence. Each command should be functional end-to-end (basic version is fine) before moving to the next.

1. **`init`** — creates `.draftwise/` skeleton, asks for AI mode (agent vs API key), scans codebase, generates `overview.md`, writes `config.yaml`. This is the foundation; nothing else works without it.

2. **`scan`** — refreshes the codebase overview and displays it. Quick incremental update if the codebase hasn't changed much.

3. **`explain <flow>`** — user specifies a flow name or feature, AI traces from entry points (routes, UI events, scheduled jobs) through services, data writes, and side effects. Outputs a walkthrough as markdown.

4. **`new "<idea>"`** — AI scans codebase relevant to the idea, runs a conversational brainstorm covering problem, users, acceptance criteria, scope, edges, metrics. Generates `product-spec.md` in `.draftwise/specs/<feature-name>/`.

5. **`tech`** — reads the product spec, generates `technical-spec.md` referencing real files, endpoints, and schemas from the scanner output. Engineer refines manually.

6. **`tasks`** — generates `tasks.md` from the technical spec. Ordered by dependency. Parallel tasks marked.

7. **`list` and `show`** — simple file system + render utilities.

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

- **File per command.** `src/commands/<n>.js` with `export default async function(args) {}`.
- **Async/await everywhere.** No `.then()` chains.
- **Console output for CLI feedback.** Use a tiny helper for colored output (kleur or chalk).
- **Errors bubble up to `src/index.js`.** It catches and prints a friendly message.
- **Test file naming:** `test/commands/<n>.test.js` tests `src/commands/<n>.js`.
- **Templates live in `src/templates/`** and are copied + filled during command execution. Don't duplicate template structure inside command files.
- **AI prompts in `src/ai/prompts/`.** One file per command's prompt. Easy to iterate, easy to test.

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

## Open questions (non-blocking for v1)

1. How deep does the codebase scan go on first run? Hard cap on files, or full scan?
2. Should `scan` cache the overview, or regenerate every time?
3. What's the right default AI model when mode is `api`?
4. How should `explain` handle very large flows that span many files?
5. When the scanner detects an unsupported framework, how should it degrade gracefully?

These don't need answers before starting. They'll surface naturally during implementation.