import { describe, it, expect } from 'vitest';
import { CORE_PRINCIPLES } from '../../src/ai/prompts/principles.js';
import {
  QUESTIONS_SYSTEM,
  STACKS_SYSTEM,
} from '../../src/ai/prompts/greenfield.js';
import {
  PLAN_SYSTEM_BROWNFIELD,
  PLAN_SYSTEM_GREENFIELD,
  SPEC_SYSTEM_BROWNFIELD,
  SPEC_SYSTEM_GREENFIELD,
} from '../../src/ai/prompts/new.js';
import {
  SYSTEM_BROWNFIELD as TECH_SYSTEM_BROWNFIELD,
  SYSTEM_GREENFIELD as TECH_SYSTEM_GREENFIELD,
} from '../../src/ai/prompts/tech.js';
import {
  SYSTEM_BROWNFIELD as TASKS_SYSTEM_BROWNFIELD,
  SYSTEM_GREENFIELD as TASKS_SYSTEM_GREENFIELD,
} from '../../src/ai/prompts/tasks.js';

describe('CORE_PRINCIPLES', () => {
  it('is a non-empty string with all eight rules visible', () => {
    expect(typeof CORE_PRINCIPLES).toBe('string');
    expect(CORE_PRINCIPLES.length).toBeGreaterThan(200);
    // Each rule's headline must appear so the model can't miss them.
    expect(CORE_PRINCIPLES).toContain('No filler');
    expect(CORE_PRINCIPLES).toContain('Redirect drift');
    expect(CORE_PRINCIPLES).toContain("Push back on weak ideas; don't validate them");
    expect(CORE_PRINCIPLES).toContain('Extend before adding');
    expect(CORE_PRINCIPLES).toContain('Right over easy');
    expect(CORE_PRINCIPLES).toContain('Flag bad assumptions');
    expect(CORE_PRINCIPLES).toContain('Verify before you assert');
    expect(CORE_PRINCIPLES).toContain('Offer the counter-case');
  });
});

describe('Every drafting / conversational SYSTEM prompt includes CORE_PRINCIPLES', () => {
  // Pull a stable substring that's specific to the principles (won't collide
  // with command-specific wording).
  const sentinel = 'Push back on weak ideas';

  const cases = [
    ['greenfield QUESTIONS_SYSTEM', QUESTIONS_SYSTEM],
    ['greenfield STACKS_SYSTEM', STACKS_SYSTEM],
    ['new PLAN_SYSTEM_BROWNFIELD', PLAN_SYSTEM_BROWNFIELD],
    ['new PLAN_SYSTEM_GREENFIELD', PLAN_SYSTEM_GREENFIELD],
    ['new SPEC_SYSTEM_BROWNFIELD', SPEC_SYSTEM_BROWNFIELD],
    ['new SPEC_SYSTEM_GREENFIELD', SPEC_SYSTEM_GREENFIELD],
    ['tech SYSTEM_BROWNFIELD', TECH_SYSTEM_BROWNFIELD],
    ['tech SYSTEM_GREENFIELD', TECH_SYSTEM_GREENFIELD],
    ['tasks SYSTEM_BROWNFIELD', TASKS_SYSTEM_BROWNFIELD],
    ['tasks SYSTEM_GREENFIELD', TASKS_SYSTEM_GREENFIELD],
  ];

  for (const [name, prompt] of cases) {
    it(`${name} contains the principles sentinel`, () => {
      expect(prompt).toContain(sentinel);
    });
  }
});
