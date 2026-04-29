// Tests run in vitest, where stdin is not a TTY by default. The new flags-first
// architecture treats non-TTY as "no inquirer fallback," which would break every
// existing test that injects `prompts` and expects them to fire.
//
// Setting process.stdin.isTTY = true here makes the default isInteractive()
// return true under test, restoring the previous behavior where injected prompts
// drive the conversation. Tests that want to exercise the non-TTY code path
// (errors when required flags are missing, decline-all opportunities, etc.)
// override per-test via `deps.isInteractive: () => false`.
process.stdin.isTTY = true;
