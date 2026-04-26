import { describe, it, expect } from 'vitest';
import { AGENT_HANDOFF_PREFIX } from '../../src/utils/agent-handoff.js';

describe('AGENT_HANDOFF_PREFIX', () => {
  it('is a non-empty string', () => {
    expect(typeof AGENT_HANDOFF_PREFIX).toBe('string');
    expect(AGENT_HANDOFF_PREFIX.length).toBeGreaterThan(40);
  });

  it('mentions agentic IDEs by name and tells the user what to do otherwise', () => {
    // Sentinel substrings the command tests rely on. Don't break these
    // without updating each command's agent-mode assertion in lockstep.
    expect(AGENT_HANDOFF_PREFIX).toContain('coding agent should pick this up');
    expect(AGENT_HANDOFF_PREFIX).toContain('plain terminal');
    expect(AGENT_HANDOFF_PREFIX).toContain('INSTRUCTION');
  });
});
