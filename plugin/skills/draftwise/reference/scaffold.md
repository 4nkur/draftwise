> **Creates initial files from a greenfield plan.** Reads `.draftwise/scaffold.json` (written by `init` in greenfield mode), confirms before writing, then creates each entry with placeholder content. Skips files that already exist. Refuses paths that escape the project root. Does NOT run setup commands — they're printed for manual execution.

Before running, remind the user that scaffolders like `create-next-app` should run BEFORE this. `draft scaffold` won't overwrite existing files but it may interfere with a fresh scaffolder run. Ask if they're ready.

If they confirm:

```
!`draft scaffold --yes $ARGUMENTS`
```

What to do with the output:

- **Success** ("Done — N created, M skipped…"): confirm to the user. Surface the printed setup commands so they know what to run manually next.

- **Brownfield short-circuit** ("scaffold is greenfield-only…"): tell the user this command only applies to greenfield projects.

- **Missing scaffold.json** (error): the greenfield plan wasn't fully written. Tell the user to re-run `/draftwise init` in greenfield mode (or write `.draftwise/scaffold.json` manually if init was run in agent mode and the host agent didn't write it).

- **Path-traversal block** ("blocked (escapes project root)"): a file path in scaffold.json tried to escape the project root. Show the user which paths were blocked and suggest reviewing `.draftwise/scaffold.json`.
