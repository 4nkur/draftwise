> **Creates initial files from a greenfield plan.** Reads `.draftwise/scaffold.json` (written by `init` in greenfield mode), confirms before writing, then creates each entry with placeholder content. Skips files that already exist. Refuses paths that escape the project root. Does NOT run setup commands — they're printed for manual execution.

## Pre-flight

- **`.draftwise/scaffold.json` exists?** Greenfield + api-mode init writes this. Greenfield + agent-mode init expects the host agent to write it; if it's missing, suggest the user re-run init or write `scaffold.json` manually from the conversation.
- **Brownfield project?** Scaffold short-circuits with a friendly hint — let the CLI handle this, but warn the user upfront if you can tell.
- **Scaffolders run first?** If the plan's `setup_commands` includes something like `npx create-next-app .` or `npm init`, those should run BEFORE scaffold. Scaffold won't overwrite existing files but it may interfere with a fresh scaffolder run that wants an empty directory. Ask the user if they've run their setup commands first; if not, suggest doing those before scaffold.

## Run

After confirming readiness:

```
!`draftwise scaffold --yes $ARGUMENTS`
```

## Reading the output

- **Success** ("Done — N created, M skipped…"): confirm to the user. Surface the printed setup commands so they know what to run manually next (Draftwise prints them but doesn't run them).

- **Brownfield short-circuit** ("scaffold is greenfield-only…"): tell the user this command only applies to greenfield projects.

- **Missing scaffold.json**: the greenfield plan wasn't fully written. Suggest re-running `/draftwise init` in greenfield mode (or writing `.draftwise/scaffold.json` manually if init was run in agent mode and the host agent didn't write it).

- **Path-traversal block** ("blocked (escapes project root)"): a file path in scaffold.json tried to escape the project root. Show the user which paths were blocked and suggest reviewing `.draftwise/scaffold.json`.
