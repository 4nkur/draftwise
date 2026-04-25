<h1 align="center">Draftwise</h1>

<p align="center">
<strong>Your codebase, explained — and turned into specs that fit it.</strong><br/>
Draftwise reads your repo, helps you understand what's already there, and drafts product and technical specs grounded in real code.
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

Draftwise makes your codebase legible — to PMs, to engineers, to whoever needs to understand what already exists before deciding what to change.

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

## Three things you'll actually use this for

**Catching up on a product you didn't build.** New job, new team, new repo. `draftwise scan` gives you a structured tour of the product as it actually exists — flows, surfaces, data, components. Your first week becomes productive instead of theoretical.

**Understanding the current state before drafting.** Before you write a spec for a change, ask Draftwise how the existing flow works. Get the truth from the code, not from a six-month-old PRD. Avoid proposing things that already exist or changes that conflict with how the system actually behaves.

**Drafting specs that engineers don't have to redo.** When you write a new feature spec, Draftwise grounds it in real components, real endpoints, real schemas. The handoff to engineering is faster because the spec already speaks the codebase's language.

---

## Quick start

Draftwise works with your AI coding agent (Claude Code, Cursor, Copilot, etc.) or a direct API key.

```bash
npm install -g draftwise

cd your-project
draftwise init
```

`draftwise init` scans your codebase and creates a `.draftwise/` folder with a structured overview of your product. From there:

```bash
draftwise scan                    # explore what's in the codebase
draftwise explain checkout        # walk a specific flow
draftwise new "your feature idea" # draft a new spec, codebase-aware
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `draftwise init` | Scan the codebase, set up `.draftwise/`, generate the initial product overview. |
| `draftwise scan` | Show a structured overview of the product — flows, surfaces, data, components. |
| `draftwise explain <flow>` | Walk through how a specific flow works today, traced from the actual code. |
| `draftwise new "<idea>"` | Conversational drafting — generates a product spec grounded in your repo. |
| `draftwise tech` | Drafts a technical spec from the product spec, referencing real files and endpoints. |
| `draftwise tasks` | Generates implementation tasks from the tech spec, ordered by dependency. |
| `draftwise list` | List all specs in the repo. |
| `draftwise show <n>` | Show a specific spec. |

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

Claude Code · GitHub Copilot · Cursor · Gemini CLI · Codex CLI · Windsurf · Amp · Roo Code · Kilo Code · OpenCode · Qoder

Or run standalone with an API key for Claude, GPT, or Gemini.

---

## Philosophy

```
→ the codebase is the source of truth — not the docs
→ understand what exists before deciding what to change
→ scan the codebase first, draft second
→ ask the right questions, don't hand over a blank template
→ product specs are jargon-free, tech specs are codebase-grounded
→ specs live with the code, not in someone's Drive
→ AI is a thought partner first, document generator second
```

---

## Roadmap

- [ ] `init` — codebase scan, `.draftwise/` setup, initial overview
- [ ] `scan` — structured product overview
- [ ] `explain` — traced walkthroughs of specific flows
- [ ] `new` — codebase-aware conversational drafting
- [ ] `tech` — technical spec grounded in real code
- [ ] `tasks` — dependency-ordered implementation breakdown
- [ ] `list` and `show` — spec browsing utilities

---

## Contributing

Early days. Issues, ideas, and PRs welcome.

If you've ever inherited a product you didn't build, or written a spec that didn't match the code — we'd love your perspective. Open a discussion.

## License

MIT
