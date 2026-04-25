import { describe, it, expect } from 'vitest';
import {
  parseQuestionsResponse,
  parseStacksResponse,
  buildOverviewMarkdown,
} from '../../src/ai/prompts/greenfield.js';

describe('parseQuestionsResponse', () => {
  it('parses a fenced JSON response', () => {
    const text =
      '```json\n' +
      JSON.stringify({
        project_title: 'Demo',
        questions: [{ text: 'Q1?', why: 'reason' }],
      }) +
      '\n```';
    const out = parseQuestionsResponse(text);
    expect(out.projectTitle).toBe('Demo');
    expect(out.questions).toHaveLength(1);
    expect(out.questions[0].text).toBe('Q1?');
  });

  it('parses raw JSON without a fence', () => {
    const out = parseQuestionsResponse(
      JSON.stringify({
        project_title: 'Demo',
        questions: [{ text: 'Q1?', why: 'r' }],
      }),
    );
    expect(out.projectTitle).toBe('Demo');
  });

  it('throws when the questions array is missing or empty', () => {
    expect(() =>
      parseQuestionsResponse(JSON.stringify({ project_title: 'Demo' })),
    ).toThrow(/missing the questions array/);
    expect(() =>
      parseQuestionsResponse(
        JSON.stringify({ project_title: 'Demo', questions: [] }),
      ),
    ).toThrow(/missing the questions array/);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseQuestionsResponse('not json')).toThrow(
      /Could not parse the clarifying questions/,
    );
  });
});

describe('parseStacksResponse', () => {
  const validStack = {
    name: 'Next.js + Postgres',
    summary: 'A summary.',
    rationale: 'Reasons.',
    pros: ['p1'],
    cons: ['c1'],
    directory_structure: '```\napp/\n```',
    initial_files: [],
    setup_commands: ['npm init -y'],
  };

  it('parses a fenced JSON response with nested directory_structure fences', () => {
    const text =
      '```json\n' +
      JSON.stringify({ stack_options: [validStack, validStack] }) +
      '\n```';
    const out = parseStacksResponse(text);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Next.js + Postgres');
    expect(out[0].directory_structure).toContain('app/');
  });

  it('throws when stack_options is missing', () => {
    expect(() => parseStacksResponse(JSON.stringify({}))).toThrow(
      /missing the stack_options array/,
    );
  });

  it('throws when an option is missing name or summary', () => {
    const bad = { stack_options: [{ name: 'X' }] };
    expect(() => parseStacksResponse(JSON.stringify(bad))).toThrow(
      /missing name or summary/,
    );
  });
});

describe('buildOverviewMarkdown', () => {
  const chosen = {
    name: 'Next.js + Postgres + Prisma',
    summary: 'Strong type safety.',
    rationale: 'You said web-first.',
    pros: ['One framework', 'Good DX'],
    cons: ['React learning curve'],
    directory_structure: '```\napp/\n```',
    initial_files: [{ path: 'app/page.tsx', purpose: 'home route' }],
    setup_commands: ['npx create-next-app@latest .'],
  };

  it('includes the title, idea, all Q&A pairs, and the chosen stack', () => {
    const md = buildOverviewMarkdown({
      projectTitle: 'Recipe app',
      idea: 'a recipe sharing app',
      questions: [
        { text: 'Public or private?', why: '...' },
        { text: 'Mobile or web?', why: '...' },
      ],
      answers: ['Public', 'Web'],
      chosen,
    });

    expect(md).toContain('# Recipe app — Greenfield plan');
    expect(md).toContain('a recipe sharing app');
    expect(md).toContain('Public or private?');
    expect(md).toContain('Mobile or web?');
    expect(md).toContain('Web');
    expect(md).toContain('## Chosen stack: Next.js + Postgres + Prisma');
    expect(md).toContain('### Pros');
    expect(md).toContain('### Cons');
    expect(md).toContain('npx create-next-app');
    expect(md).toContain('app/page.tsx');
  });

  it('marks skipped answers visibly', () => {
    const md = buildOverviewMarkdown({
      projectTitle: 'X',
      idea: 'idea',
      questions: [{ text: 'Q?', why: 'w' }],
      answers: [''],
      chosen,
    });
    expect(md).toContain('_(skipped)_');
  });
});
