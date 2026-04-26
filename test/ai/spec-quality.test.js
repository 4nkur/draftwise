import { describe, it, expect } from 'vitest';
import {
  SPEC_LANGUAGE_RULES,
  EDGE_CASE_DISCIPLINE,
} from '../../src/ai/prompts/spec-quality.js';
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

describe('SPEC_LANGUAGE_RULES', () => {
  it('is a non-empty string with all seven rules visible', () => {
    expect(typeof SPEC_LANGUAGE_RULES).toBe('string');
    expect(SPEC_LANGUAGE_RULES.length).toBeGreaterThan(200);
    expect(SPEC_LANGUAGE_RULES).toContain('Specific over generic');
    expect(SPEC_LANGUAGE_RULES).toContain('Active language');
    expect(SPEC_LANGUAGE_RULES).toContain('Same term every time');
    expect(SPEC_LANGUAGE_RULES).toContain('Cut filler');
    expect(SPEC_LANGUAGE_RULES).toContain('Concrete examples');
    expect(SPEC_LANGUAGE_RULES).toContain("Don't blame users");
    expect(SPEC_LANGUAGE_RULES).toContain('Equal-effort sections');
  });
});

describe('EDGE_CASE_DISCIPLINE', () => {
  it('names every category an engineer should cover', () => {
    expect(typeof EDGE_CASE_DISCIPLINE).toBe('string');
    expect(EDGE_CASE_DISCIPLINE.length).toBeGreaterThan(150);
    expect(EDGE_CASE_DISCIPLINE).toContain('Empty data');
    expect(EDGE_CASE_DISCIPLINE).toContain('Errors');
    expect(EDGE_CASE_DISCIPLINE).toContain('Loading');
    expect(EDGE_CASE_DISCIPLINE).toContain('Permissions');
    expect(EDGE_CASE_DISCIPLINE).toContain('Concurrency');
    expect(EDGE_CASE_DISCIPLINE).toContain('Large data');
  });
});

describe('SPEC_LANGUAGE_RULES injection', () => {
  // Sentinel chosen to be specific to spec-quality, not principles.
  const sentinel = 'Specific over generic';

  // Synthesis prompts (the ones that draft prose) MUST include the rules.
  const includes = [
    ['new SPEC_SYSTEM_BROWNFIELD', SPEC_SYSTEM_BROWNFIELD],
    ['new SPEC_SYSTEM_GREENFIELD', SPEC_SYSTEM_GREENFIELD],
    ['tech SYSTEM_BROWNFIELD', TECH_SYSTEM_BROWNFIELD],
    ['tech SYSTEM_GREENFIELD', TECH_SYSTEM_GREENFIELD],
  ];

  // JSON / plan / list-shaped prompts MUST NOT — these aren't drafting prose,
  // and the extra tokens would just dilute the format-specific instructions.
  const excludes = [
    ['greenfield QUESTIONS_SYSTEM', QUESTIONS_SYSTEM],
    ['greenfield STACKS_SYSTEM', STACKS_SYSTEM],
    ['new PLAN_SYSTEM_BROWNFIELD', PLAN_SYSTEM_BROWNFIELD],
    ['new PLAN_SYSTEM_GREENFIELD', PLAN_SYSTEM_GREENFIELD],
    ['tasks SYSTEM_BROWNFIELD', TASKS_SYSTEM_BROWNFIELD],
    ['tasks SYSTEM_GREENFIELD', TASKS_SYSTEM_GREENFIELD],
  ];

  for (const [name, prompt] of includes) {
    it(`${name} contains the language rules`, () => {
      expect(prompt).toContain(sentinel);
    });
  }

  for (const [name, prompt] of excludes) {
    it(`${name} does not contain the language rules`, () => {
      expect(prompt).not.toContain(sentinel);
    });
  }
});

describe('EDGE_CASE_DISCIPLINE injection', () => {
  // Edge-case discipline is a technical-spec concern only.
  const sentinel = 'Edge cases for the technical spec';

  it('appears in tech SYSTEM_BROWNFIELD', () => {
    expect(TECH_SYSTEM_BROWNFIELD).toContain(sentinel);
  });

  it('appears in tech SYSTEM_GREENFIELD', () => {
    expect(TECH_SYSTEM_GREENFIELD).toContain(sentinel);
  });

  it('does not appear in product spec prompts', () => {
    expect(SPEC_SYSTEM_BROWNFIELD).not.toContain(sentinel);
    expect(SPEC_SYSTEM_GREENFIELD).not.toContain(sentinel);
  });

  it('does not appear in plan, tasks, or greenfield discovery prompts', () => {
    expect(PLAN_SYSTEM_BROWNFIELD).not.toContain(sentinel);
    expect(PLAN_SYSTEM_GREENFIELD).not.toContain(sentinel);
    expect(TASKS_SYSTEM_BROWNFIELD).not.toContain(sentinel);
    expect(TASKS_SYSTEM_GREENFIELD).not.toContain(sentinel);
    expect(QUESTIONS_SYSTEM).not.toContain(sentinel);
    expect(STACKS_SYSTEM).not.toContain(sentinel);
  });
});
