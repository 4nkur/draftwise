// Shared orienting prefix logged before every agent-mode handoff.
//
// Inside an agentic IDE (Claude Code, Cursor, Antigravity, Copilot, etc.) the
// host model picks up the structured block below automatically. In a plain
// terminal the human sees what would otherwise look like noise — JSON +
// instruction text — with no signal that they're meant to do something with
// it. This one line orients them.
//
// Every block ends with a section labeled INSTRUCTION, so the "through the end
// of INSTRUCTION" framing works for all six callers (init / scan / explain /
// new / tech / tasks).

export const AGENT_HANDOFF_PREFIX =
  '(your coding agent should pick this up automatically inside Claude Code, Cursor, Antigravity, etc. ' +
  'In a plain terminal, copy the block below — through the end of INSTRUCTION — into your AI assistant.)';
