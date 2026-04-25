<h1 align="center">Draftwise</h1>

<p align="center">
<strong>From idea to shipped spec — grounded in real code.</strong><br/>
Draftwise helps PMs and product builders go from a blank directory or an existing repo to a thought-through plan, then to specs that fit.
</p>

<p align="center">
<a href="#the-problem">The Problem</a> ·
<a href="#how-draftwise-helps">How It Helps</a> ·
<a href="#quick-start">Quick Start</a> ·
<a href="#commands">Commands</a>
</p>

<p align="center">
<a href="https://www.npmjs.com/package/draftwise"><img src="https://img.shields.io/npm/v/draftwise?style=flat-square" alt="npm version" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

## The problem

Every product team hits the same wall: **the codebase knows things the team doesn't.**

#### 📜 Old specs are stale
PMs writing a new spec end up doing detective work — clicking through the app, pinging engineers, reading PRs — just to figure out how the feature actually works today. Hours of work before any writing starts.

#### 🔁 Skipping the detective work backfires
Specs based on outdated assumptions trigger back-and-forth the moment dev picks them up. *"This isn't how it works anymore."* *"That endpoint was deprecated."* The spec gets rewritten during code review.

#### 🧭 New PMs fly blind for months
Joining a team means inheriting a product you didn't build. Old specs don't match the code. Engineers are busy. Weeks pass before you have a working mental model — and every spec written in that time is shaky.

#### 🫥 Specs get written in a vacuum
Without deep knowledge of the codebase, PMs reach for generic language. They miss components that already exist, propose duplicates of shipped features, or specify changes to systems they don't understand.

#### 🔧 Engineers redo the work
A generic spec arrives. Engineers redraft it in their head against the real code — figuring out which components exist, working out data model implications, catching missed edge cases. Half the time, what ships isn't what was specced.

#### 🔄 Six months later, the cycle repeats
Knowledge about how the product is actually built lives only in code and in people's heads. The next PM starts the same loop. Same stale docs, same detective work, same drift.

---

## How Draftwise helps

Draftwise meets you where your project is — whether you're staring at a blank directory or trying to make sense of a repo someone else built.

#### 🌱 Starts you on the right stack (greenfield)
`draftwise init` in a fresh directory walks you through clarifying questions, then proposes 2-3 stack options with rationale, pros, cons, a directory structure, and the exact setup commands to run. No more "should I use Next or Remix?" tab-shopping.

#### 🗺️ Explains an existing product back to you (brownfield)

#### 🗺️ Explains your product back to you
`draftwise scan` gives you a structured overview of what's in your codebase: major flows, API surface, data model, components, how they connect. New PMs catch up in an afternoon, not three weeks.

#### 🔎 Traces the current behavior of any feature
Ask Draftwise *"how does checkout work today?"* and it walks the actual code — routes hit, services called, data written, side effects triggered. No more pinging engineers to verify how something works.

#### 🧩 Reads your repo before drafting anything
Every spec Draftwise generates references real entities from your codebase — actual file paths, real endpoints, real schema names — not generic placeholders.

#### 💬 Guides you through a structured brainstorm
No blank template. Draftwise walks you through what matters — problem, users, acceptance criteria, scope, edge cases, metrics — while keeping codebase context in view. You answer in plain language. It does the structuring.

#### ✂️ Separates product specs from technical specs
Product spec: what & why, readable by anyone. Technical spec: how, grounded in your real code. Same feature, two lenses, two audiences.

#### 📁 Saves everything in your repo
Specs and codebase summaries live as markdown files in `.draftwise/`. Version-controlled, searchable, alongside the code. No Drive folders. No drift.

---

## Four things you'll actually use this for

**Starting a new project from scratch.** You have an idea but no code yet. `draftwise init` walks you through what you want to build, asks the questions a sharp engineer would ask, and proposes 2-3 stack options with rationale, pros, cons, directory structure, and setup commands. Pick one and start coding.

**Catching up on a product you didn't build.** New job, new team, new repo. `draftwise scan` gives you a structured tour of the product as it actually exists — flows, surfaces, data, components. Your first week becomes productive instead of theoretical.

**Understanding the current state before drafting.** Before you write a spec for a change, ask Draftwise how the existing flow works. Get the truth from the code, not from a six-month-old PRD. Avoid proposing things that already exist or changes that conflict with how the system actually behaves.

**Drafting specs that engineers don't have to redo.** When you write a new feature spec, Draftwise grounds it in real components, real endpoints, real schemas. The handoff to engineering is faster because the spec already speaks the codebase's language.

---

## Quick start

Draftwise works with your AI coding agent (Claude Code, Cursor, Antigravity, Copilot, etc.) or a direct API key.

```bash
npm install -g draftwise

cd your-project          # existing repo, or an empty directory for a new project
draftwise init
```

`draftwise init` first asks whether you're starting **greenfield** (no code yet) or **brownfield** (existing codebase) and routes accordingly:

- **Greenfield:** describe the idea → answer 4-6 clarifying questions → pick from 2-3 stack options → get a plan with directory structure and setup commands.
- **Brownfield:** scans the repo and writes an overview of flows, routes, components, and models.

Either way, you end up in `.draftwise/` with `overview.md` and `config.yaml`. From there:

```bash
draftwise scan                    # refresh the codebase overview (brownfield only)
draftwise explain checkout        # walk a specific flow (brownfield only)
draftwise new "your feature idea" # draft a new spec
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `draftwise init` | Set up `.draftwise/`. Asks whether the project is greenfield or brownfield and routes accordingly — either a stack-recommendation conversation or a codebase scan. |
| `draftwise scan` | Refresh the structured codebase overview (brownfield). |
| `draftwise explain <flow>` | Walk through how a specific flow works today, traced from the actual code (brownfield). |
| `draftwise new "<idea>"` | Conversational drafting — generates a product spec grounded in the codebase or the greenfield plan. |
| `draftwise tech [<feature>]` | Drafts a technical spec from the product spec, referencing real files and endpoints. |
| `draftwise tasks [<feature>]` | Generates implementation tasks from the tech spec, ordered by dependency. |
| `draftwise list` | List all specs in `.draftwise/specs/`. |
| `draftwise show <feature> [type]` | Show a specific spec (type: `product`, `tech`, or `tasks`; default: `product`). |

---

## What lives in your repo

```
.draftwise/
├── overview.md                     # codebase summary — flows, surfaces, data, components
├── specs/
│   └── add-collaborative-albums/
│       ├── product-spec.md         # what & why
│       ├── technical-spec.md       # how — grounded in your code
│       └── tasks.md                # ordered breakdown
└── config.yaml
```

Markdown. Version-controlled. Travels with your repo.

---

## What you get from each command

**`draftwise scan`** — a structured codebase overview:
- Major flows in the product (signup, checkout, sharing, etc.)
- API surface (endpoints, methods, what they do)
- Data model (key tables, key relationships)
- Component map (what's in your UI, how it's organized)
- Integrations and external dependencies

**`draftwise explain <flow>`** — a traced walkthrough:
- The entry points (routes, UI events, scheduled jobs)
- The services and functions involved
- The data read and written
- Side effects (emails, webhooks, async jobs)
- Edge cases the code actually handles

**`draftwise new`** — a product spec with:
- Problem with evidence
- User stories & acceptance criteria
- Flows, touchpoints, edge cases
- Scope: covered, assumed, hypothesized, out of scope
- Core metrics & counter metrics

**`draftwise tech`** — a technical spec grounded in real code:
- Data model changes (your actual schema)
- API changes (your actual conventions)
- Component changes (your actual files)
- Migration notes & test plan

---

## Spec templates

<details>
<summary><strong>Product spec sections</strong></summary>

```
Problem                  → what's broken, with evidence
User stories             → who wants what and why
Acceptance criteria      → given / when / then
Flows & touchpoints      → UI/UX, screen copy, interactions
Edge cases               → what happens when things go wrong
Test cases               → product-level scenarios
Scope: covered           → what this includes
Scope: assumed           → what we're taking as given
Scope: hypothesized      → what we believe but haven't proven
Scope: out of scope      → what this explicitly excludes
Core metrics             → what success looks like
Counter metrics          → what could go wrong if we succeed
```
</details>

<details>
<summary><strong>Technical spec sections</strong></summary>

```
Summary                  → what & why, references the product spec
Data model changes       → tables, columns, migrations
API changes              → new & modified endpoints
Component changes        → new & modified files
Migration notes          → deployment considerations
Test plan                → unit, integration, E2E
```
</details>

---

## Agent compatibility

Draftwise's agent mode is designed to be host-agnostic — the CLI prints structured scanner data and an instruction string; the host's model handles the reasoning. In principle that works with any agentic IDE or CLI:

Claude Code · GitHub Copilot · Cursor · Gemini CLI · Codex CLI · Antigravity · Windsurf · Amp · Roo Code · Kilo Code · OpenCode · Qoder

In practice it has only been smoke-tested in a plain terminal so far. If you run it inside one of these and something breaks, please open an issue.

Standalone (API mode) currently supports:

- ✅ **Claude** (Anthropic) — fully wired
- ⏳ **GPT (OpenAI)** — adapter not yet implemented
- ⏳ **Gemini** (Google) — adapter not yet implemented

Until the OpenAI and Gemini adapters land, pick `agent` mode at `draftwise init` if you want to use those models — they'll work via the host (e.g. Gemini via Antigravity or Gemini CLI; GPT via Codex CLI or Copilot).

---

## Philosophy

```
→ the codebase is the source of truth — not the docs (when there is one)
→ for brand-new projects, the conversation is the source of truth — not boilerplate
→ understand what exists before deciding what to change
→ ask the right questions, don't hand over a blank template
→ propose options with rationale; let the human pick
→ product specs are jargon-free, tech specs are codebase-grounded
→ specs live with the code, not in someone's Drive
→ AI is a thought partner first, document generator second
```

---

## Roadmap

v1 commands are all shipped on `npm` as of `0.0.1`. The next published release will be `0.1.0` after end-to-end smoke testing on a sample repo.

- [x] `init` — `.draftwise/` setup, with greenfield (stack recommendation) and brownfield (codebase scan) routing
- [x] `scan` — structured product overview (brownfield); friendly short-circuit in greenfield
- [x] `explain` — traced walkthroughs of specific flows (brownfield); friendly short-circuit in greenfield
- [x] `new` — conversational spec drafting, greenfield-aware (drops affected_flows / adjacent_opportunities when there's no code yet)
- [x] `tech` — technical spec, greenfield-aware (every file marked `(new)`, follows the planned directory structure)
- [x] `tasks` — dependency-ordered breakdown, greenfield-aware (first 1-3 tasks are project setup before feature work)
- [x] `list` and `show` — spec browsing utilities
- [ ] optional file scaffolding from `init`'s greenfield plan (planned)

**Next:** OpenAI and Gemini provider adapters (Claude is the only fully-wired adapter today), framework support beyond JS/TS Node (Python, Go, Rust), greenfield-aware downstream commands, and a flag-aware scanner cache for very large repos.

---

## Contributing

Early days. Issues, ideas, and PRs welcome.

If you've ever inherited a product you didn't build, or written a spec that didn't match the code — we'd love your perspective. Open a discussion.

## License

MIT
