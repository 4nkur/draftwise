// Returns true when running in an interactive shell where inquirer prompts can
// fire safely. False inside a coding-agent shell (Claude Code, Cursor) or CI,
// where stdin isn't a TTY and inquirer would either hang waiting for input or
// throw a force-exit error. Commands check this before falling back to a
// prompt for a missing flag value — non-TTY callers must supply every value
// via flags.
export function isInteractive() {
  return Boolean(process.stdin.isTTY);
}
