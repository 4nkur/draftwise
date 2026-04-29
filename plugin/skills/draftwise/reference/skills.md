> **Manages Draftwise's standalone slash-command skill across AI harnesses.** Three subcommands: `install` (writes SKILL.md into `~/.<provider>/skills/draftwise/` for each known harness), `uninstall` (removes those dirs), `help` (reports what's installed where). Each provider gets the same SKILL.md body; Claude-only frontmatter (`user-invocable`, `argument-hint`, `allowed-tools`) is stripped on the way out so other parsers don't trip. Supported harnesses today: Claude Code, Cursor, Gemini CLI. The marketplace plugin (which produces `/draftwise:draftwise <verb>` in Claude Code) is independent and untouched.

## Routing — which subcommand was asked?

Map the user's phrasing:

- "install draftwise as a skill" / "make /draftwise <verb> work" / "drop the namespace prefix" / "install in cursor" → `skills install`
- "remove the draftwise skill" / "uninstall the standalone skill" → `skills uninstall`
- "what's installed" / "where is draftwise installed" / "show install state" → `skills help`

If the user says "uninstall draftwise" without context, ask whether they mean (a) the standalone skill (this command), (b) the marketplace plugin (`/plugin uninstall draftwise` in Claude Code), or (c) the npm CLI (`npm uninstall -g draftwise`). They're three different things.

## Pre-flight (install / uninstall)

- **`draftwise` on PATH?** If `which draftwise` (or `where draftwise`) fails, the user hasn't installed the CLI yet. Suggest `npm i -g draftwise` first; both `skills install` and `skills uninstall` are subcommands of that CLI.
- **Existing standalone install?** `skills install` refuses to overwrite without `--force`. Don't pass `--force` without explicit user confirmation — they may have hand-edited SKILL.md.

## Run

```
!`draftwise skills install $ARGUMENTS`
```

```
!`draftwise skills uninstall $ARGUMENTS`
```

```
!`draftwise skills help`
```

Pass-through flags worth recognizing:

- `--provider=claude|cursor|gemini|all` — narrow the operation. Default `all`.
- `--scope=user|project` — `user` writes to `~/.<provider>/skills/draftwise/`; `project` writes to `<cwd>/.<provider>/skills/draftwise/`. Default `user`.
- `--force` — install only — overwrite existing.

## Reading the output

### `skills install`

- **"Installed Draftwise skill for <Harness>: …" lines, one per provider**: success. Tell the user to try `/draftwise init` (bare form) in a fresh window or after their harness reloads. Both bare `/draftwise <verb>` and (if the marketplace plugin is also installed) `/draftwise:draftwise <verb>` will appear in the slash menu — they shell out to the same CLI; pick either.
- **"Target dirs already exist: …\nPass --force to overwrite"**: don't auto-retry with `--force`. Ask the user whether the existing files have hand-edits worth preserving. If yes, suggest `draftwise skills uninstall` first or copy the files aside.
- **"Skill source not found at …"**: the npm package is broken or stale. Suggest `npm i -g draftwise@latest`.
- **"Invalid --provider value …"**: only `claude`, `cursor`, `gemini`, `all` are valid. Translate the user's intent.

### `skills uninstall`

- **"Removed …" lines + "Done — N removed[, M skipped]"**: success. If the user only meant to remove from one harness and the others are still installed, that's fine — they can ignore the skipped lines. If they wanted everything gone, confirm with `draftwise skills help` afterward.
- **"No standalone Draftwise skill found at --scope=… (Wrong --scope?)"**: they likely installed at the other scope. Suggest re-running with `--scope=project` (or `user`) and confirm.

### `skills help`

- A 3×2 table (3 harnesses × 2 scopes). Show it to the user as-is — it's the deliverable. If everything is "not installed", suggest `draftwise skills install`. If the user is confused about why Claude Code shows two slash forms, point at the marketplace plugin vs. standalone-skill split (`/plugin install draftwise` produces the namespaced form; `skills install` produces the bare form).

## When to suggest these

- User asks "how do I install draftwise as a skill" / "make /draftwise <verb> work without the prefix" / "install in Cursor" → `skills install`.
- User just ran `npm i -g draftwise` and asks how to wire up their harness without going through `/plugin install` → `skills install`.
- User has the marketplace plugin installed and complains about the `/draftwise:draftwise` form → point at `skills install` for the bare alternative.
- User wants to remove or audit installs across harnesses → `skills uninstall` or `skills help`.

## What not to do

- Don't pass `--force` on install without explicit confirmation.
- Don't claim the marketplace plugin is removed — `skills uninstall` doesn't touch it. Manage that via `/plugin uninstall draftwise`.
- Don't `rm -rf` `~/.<provider>/skills/draftwise/` instead of running `skills uninstall` — losing the structured uninstall makes troubleshooting harder if the harness keeps showing the bare slash form (probably stale cache).
- Don't recommend uninstalling everything (standalone + marketplace + npm CLI) in a single breath unless the user explicitly asked for full removal. They're three independent install paths and may have different reasons to keep one.
