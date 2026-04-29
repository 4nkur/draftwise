> **Removes a standalone Draftwise skill install** from `~/.claude/skills/draftwise/` (default) or `<cwd>/.claude/skills/draftwise/` (with `--scope=project`). Doesn't touch the marketplace plugin — that's managed via Claude Code's `/plugin uninstall draftwise`.

## Pre-flight

- **Did the user install at user or project scope?** If they're not sure, default to `--scope=user` (matches `install-skill`'s default). If the command errors with "No standalone Draftwise skill at …" that's the signal to try the other scope.

## Run

```
!`draftwise uninstall-skill $ARGUMENTS`
```

## Reading the output

- **"Removed …"**: the user-scope or project-scope skill dir is gone. Note that the marketplace plugin (if installed) still produces `/draftwise:draftwise <verb>` — to remove that too, point at Claude Code's `/plugin uninstall draftwise`.

- **"No standalone Draftwise skill at … (Wrong --scope?)"**: the user installed at the other scope, or never ran `install-skill`. Suggest re-running with `--scope=project` (or `--scope=user`) and confirm.

## What not to do

- Don't run `rm -rf` on `~/.claude/skills/draftwise/` instead of using this command — losing the structured uninstall makes it harder to debug if Claude Code keeps showing the bare slash form (probably a stale cache).
- Don't recommend uninstalling both the standalone skill AND the marketplace plugin in the same breath unless the user explicitly asked for a full removal. They're separate install paths and may have different reasons to keep one.
