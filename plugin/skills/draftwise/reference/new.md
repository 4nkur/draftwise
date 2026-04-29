> **Drafts a product spec for a feature idea.** Three phases: (1) AI plans the conversation — clarifying questions tailored to the codebase or greenfield plan, plus affected flows and adjacent opportunities. (2) The user walks through questions and accepts/declines opportunities. (3) AI synthesizes `product-spec.md` under `.draftwise/specs/<slug>/`.

The user supplied an idea (or you should ask for one if missing). First invocation:

```
!`draft new $ARGUMENTS`
```

What happened:

- **agent mode** (you see SCANNER OUTPUT or PROJECT PLAN, then IDEA, then a 3-phase INSTRUCTION block): the CLI handed you the conversation. Follow the INSTRUCTION exactly — walk the user through clarifying questions, accept/decline adjacent opportunities, then write `product-spec.md` yourself grounded in the scanner data (or project plan, for greenfield). Don't invent files. The CLI did NOT write the spec in this mode; that's your job.

- **api mode, success** (streamed markdown ending with "Wrote .draftwise/specs/<slug>/product-spec.md"): the CLI already wrote it. Confirm to the user and surface the `Next:` step ("run `/draftwise tech`").

- **api mode + non-TTY without --answers** (the CLI logged "(non-interactive: no --answers supplied — questions left blank.)"): the model produced a leaner spec from its best guess. If the user wants a richer one, walk them through the clarifying questions yourself (the plan output above lists them) and re-invoke:

  ```
  !`draft new "<idea>" --answers '["answer1", "answer2"]' --force`
  ```

- **Existing spec** (error: "already exists. Pass --force"): ask the user if they want to overwrite. If yes, re-invoke with `--force`.

- **No idea given** (error: "Missing idea"): ask what feature they want drafted, then re-invoke.
