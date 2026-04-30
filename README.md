<h1 align="center">Draftwise</h1>

<p align="center">
<strong>From idea to shipped spec — grounded in real code.</strong><br/>
Turn a blank directory or an existing repo into specs your engineers won't have to redo.
</p>

<p align="center">
<a href="#the-problem">The problem</a> ·
<a href="#how-draftwise-helps">How it helps</a> ·
<a href="#quick-start">Quick start</a> ·
<a href="#commands">Commands</a> ·
<a href="#philosophy">Philosophy</a>
</p>

<p align="center">
<a href="https://www.npmjs.com/package/draftwise"><img src="https://img.shields.io/npm/v/draftwise?style=flat-square" alt="npm version" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
</p>

---

## The problem

**The codebase knows things the team doesn't.** PMs writing a spec spend hours on detective work — clicking through the app, pinging engineers, reading PRs — just to figure out how a feature actually works today. Skip the detective work and the spec gets rewritten in code review.

**New PMs fly blind for months.** Old specs don't match the code. Engineers are busy. Weeks pass before there's a working mental model — and every spec written in that time is shaky.

**Engineers redo the work.** A generic spec arrives. Engineers redraft it in their head against the real code. Half of what ships isn't what was specced. Six months later, the next PM repeats the loop.

---

## How Draftwise helps

Draftwise meets you where the project is — blank directory or existing repo.

#### 🌱 Starting a new project from scratch
You have an idea but no code yet. `draftwise init` hands the idea to your coding agent, which walks you through clarifying questions and proposes 2-3 stack options (rationale, pros, cons, directory structure, setup commands). Pick one and start coding. Optional: `draftwise scaffold --yes` creates the initial files.

#### 🗺️ Catching up on a product you didn't build
New job, new team, new repo. `draftwise scan` reads the codebase and writes a structured overview — flows, API surface, data model, components, integrations. Your first week becomes productive instead of theoretical.

#### 🔎 Understanding the current state before drafting
Before specifying a change, ask `draftwise explain <flow>`. The CLI walks the actual code — routes hit, services called, data written, edge cases handled. Avoid proposing things that already exist or changes that conflict with how the system actually behaves.

#### 🧩 Drafting specs engineers don't have to redo
`draftwise new "<idea>"` walks the conversation through clarifying questions and accept/decline opportunities, then writes a product spec grounded in real files, endpoints, and schemas — not generic placeholders. `draftwise tech` and `draftwise tasks` follow with the engineering counterparts. New code paths get a `(new)` marker so reviewers can tell intent from existing state at a glance.

---

## Quick start

Draftwise runs inside your AI coding agent (Claude Code, Cursor, Gemini CLI, Antigravity, Copilot, etc.). The CLI scans your repo and prints an instruction; the agent does the drafting.

```bash
npm install -g draftwise

cd your-project          # existing repo, or an empty directory
draftwise init
```

`draftwise init` checks the directory for source files and routes accordingly:

- **New project (no code yet):** prints clarifying questions for your agent. The agent walks you through stack selection (2-3 options) and writes the chosen plan + setup commands to `.draftwise/overview.md`. Run `draftwise scaffold --yes` next to create the initial files.
- **Existing codebase:** scans the repo, writes an `overview.md` placeholder, and tells you to run `draftwise scan` next.

Detection is automatic; pass `--mode=greenfield|brownfield` to override. Either way, `.draftwise/` ends up with `overview.md` and `config.yaml`. From there:

```bash
draftwise scan                    # refresh codebase overview (brownfield only)
draftwise explain checkout        # trace a specific flow (brownfield only)
draftwise new "your feature idea" # draft a product spec
draftwise tech                    # technical spec from the product spec
draftwise tasks                   # ordered work breakdown from the tech spec
```

### Slash commands inside your AI harness

```bash
draftwise skills install                  # auto-detects ~/.claude, ~/.cursor, ~/.gemini
draftwise skills install --provider=all   # write to every known dir
draftwise skills help                     # see what's installed where
```

The slash form is bare `/draftwise init`, `/draftwise new "<idea>"`, etc. — matches the CLI binary.

<details>
<summary>Or via the Claude Code plugin marketplace</summary>

```
/plugin marketplace add 4nkur/draftwise
/plugin install draftwise
```

Claude Code namespaces plugin skills as `<plugin>:<skill>`, so the slash form is `/draftwise:draftwise <verb>`. Both paths are independent and may coexist.
</details>

---

## Commands

| Command | What it does |
|---------|--------------|
| `draftwise init` | Set up `.draftwise/`. Auto-detects greenfield vs brownfield (override with `--mode`). |
| `draftwise scan` | Refresh the codebase overview (brownfield). |
| `draftwise explain <flow>` | Trace a specific flow through the code (brownfield). |
| `draftwise new "<idea>"` | Draft a product spec — clarifying questions plus grounded synthesis. |
| `draftwise tech [<feature>]` | Technical spec from the product spec, grounded in real files. |
| `draftwise tasks [<feature>]` | Implementation tasks from the tech spec, dependency-ordered. |
| `draftwise scaffold --yes` | Create initial files from a greenfield plan. |
| `draftwise list` | List all specs in `.draftwise/specs/`. |
| `draftwise show <feature> [type]` | Show a spec (`product`, `tech`, or `tasks`; default: `product`). |
| `draftwise skills <install\|uninstall\|help>` | Manage standalone slash-command skills. |

Run `draftwise <command> --help` for the per-command flag list.

---

## What lives in your repo

```
.draftwise/
├── .gitignore                # written by init; keeps the cache out of version control
├── constitution.md           # voice + spec-quality rules — edit to suit your project
├── overview.md               # codebase summary (brownfield) or greenfield plan
├── scaffold.json             # greenfield only; structured stack data for `draftwise scaffold`
├── specs/
│   └── <feature-slug>/
│       ├── product-spec.md   # what & why
│       ├── technical-spec.md # how — grounded in real code (or "(new)" for greenfield)
│       └── tasks.md          # ordered work breakdown
└── config.yaml
```

Markdown. Version-controlled. Travels with your repo. (Draftwise also writes a `.cache/` folder that's gitignored automatically — fingerprint-based scan cache, invalidates on any code change.)

---

<details>
<summary><strong>Product spec sections</strong></summary>

Optional YAML frontmatter at the top of `product-spec.md` declares cross-spec relationships, surfaced in `draftwise list`'s `DEPENDS ON` column:

```yaml
---
depends_on: [auth, billing]   # specs that must ship before this one
related: [profile-page]       # same area; not a hard dependency
---
```

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

Draftwise is host-agnostic — the CLI prints scanner data and an instruction; the host's model handles the reasoning and writes the spec. In principle that works with any agentic IDE: Claude Code, Cursor, Gemini CLI, Codex CLI, Antigravity, Copilot, Windsurf, Amp, Roo Code, Kilo Code, OpenCode, Qoder. In practice only the plain terminal has been smoke-tested — open an issue if you hit something.

**Flags-driven, never blocks.** Every command takes its input via flags or positional args; missing required input errors with a usage hint instead of waiting on stdin. A slash-command wrapper (or any host agent) collects answers in chat and re-invokes `draftwise <command>` with the right flags. `draftwise init` greenfield without `--idea` prints a structured handoff for the agent — copy it into your AI assistant if you're not already inside one.

---

## Philosophy

```
→ the codebase is the source of truth — not the docs
→ for brand-new projects, the conversation is the source of truth — not boilerplate
→ understand what exists before deciding what to change
→ ask the right questions, don't hand over a blank template
→ propose options with rationale; let the human pick
→ product specs are jargon-free; tech specs are codebase-grounded
→ specs live with the code, not in someone's Drive
→ AI is a thought partner first, document generator second
→ push back on weak ideas; don't validate them — better outputs come from real friction
→ flag bad assumptions before drafting; mark uncertain claims; offer the counter-case on big decisions
→ extend what exists before adding new files / routes / components
```

---

## Contributing

Early days. Issues, ideas, and PRs welcome. If you've ever inherited a product you didn't build, or written a spec that didn't match the code — open a discussion.

## License

MIT
