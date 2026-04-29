> **Installs Draftwise as a standalone Claude Code skill** at `~/.claude/skills/draftwise/` (default) or `<cwd>/.claude/skills/draftwise/` (with `--scope=project`). Result: bare `/draftwise <verb>` slash form in chat, matching the CLI binary — no `<plugin>:<skill>` namespace prefix. The marketplace plugin install (which produces `/draftwise:draftwise <verb>`) is independent and untouched.

## Pre-flight

- **`draftwise` on PATH?** If `which draftwise` (or `where draftwise`) fails, the user hasn't installed the CLI yet. Suggest `npm i -g draftwise` first; this command is part of that CLI.
- **Existing standalone install?** If `~/.claude/skills/draftwise/SKILL.md` (or the project equivalent) already exists, the command refuses without `--force`. Don't pass `--force` without explicit user confirmation — they may have hand-edited the SKILL.md.

## Run

```
!`draftwise install-skill $ARGUMENTS`
```

If the user said "install at project scope" or similar, pass `--scope=project`. If they said "overwrite" / "replace" / "force", add `--force` after confirming.

## Reading the output

- **"Installed Draftwise skill at …"**: success. Tell the user to try `/draftwise init` (bare form, no namespace) in a fresh Claude Code window or after `/reload-plugins`. Both the bare `/draftwise <verb>` and the marketplace `/draftwise:draftwise <verb>` will now appear in the slash menu — they shell out to the same CLI, the user can pick either.

- **"… already exists. Pass --force to overwrite"**: don't auto-retry with `--force`. Ask the user whether the existing SKILL.md has hand-edits worth preserving. If yes, suggest `draftwise uninstall-skill` first or copy the file aside. If no, re-run with `--force`.

- **"Skill source not found at …"**: the npm package is broken or stale. Suggest `npm i -g draftwise@latest`.

- **"Invalid --scope value …"**: only `user` and `project` are valid. Translate the user's intent if they used another word.

## When to suggest this

- User asks "how do I install draftwise as a skill" / "make /draftwise <verb> work without the prefix" / "drop the draftwise:draftwise prefix" / "install in this project only".
- User just ran `npm i -g draftwise` and asks how to wire up Claude Code without going through `/plugin install`.
- User has the marketplace plugin installed and complains about the `/draftwise:draftwise` form being awkward — point at this command as the alternative path.

## What not to do

- Don't pass `--force` without explicit confirmation.
- Don't claim the marketplace plugin is removed — `install-skill` doesn't touch it. The user manages that via Claude Code's `/plugin uninstall draftwise`.
- Don't suggest editing files under `~/.claude/skills/draftwise/` directly. Re-running `install-skill --force` is the supported update path.
