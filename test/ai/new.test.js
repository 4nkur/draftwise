import { describe, it, expect } from 'vitest';
import { parsePlanResponse } from '../../src/ai/prompts/new.js';

describe('parsePlanResponse', () => {
  const valid = {
    feature_slug: 'collab-albums',
    feature_title: 'Collaborative Albums',
    affected_flows: [
      { name: 'album-create', files: ['src/api/albums.ts'], impact: 'now multi-user' },
    ],
    clarifying_questions: [
      { text: 'Who can invite?', why: 'permissions are unclear from the scanner' },
    ],
    adjacent_opportunities: [
      { flow: 'sharing', suggestion: 'unify share + invite', rationale: 'avoids drift' },
    ],
  };

  it('parses a fenced ```json block', () => {
    const text = 'preamble\n```json\n' + JSON.stringify(valid) + '\n```\nepilogue';
    const out = parsePlanResponse(text);
    expect(out.featureSlug).toBe('collab-albums');
    expect(out.featureTitle).toBe('Collaborative Albums');
    expect(out.clarifyingQuestions).toHaveLength(1);
    expect(out.affectedFlows[0].files[0]).toBe('src/api/albums.ts');
    expect(out.adjacentOpportunities[0].flow).toBe('sharing');
  });

  it('parses raw JSON without a code fence', () => {
    const out = parsePlanResponse(JSON.stringify(valid));
    expect(out.featureSlug).toBe('collab-albums');
  });

  it('defaults missing arrays to empty', () => {
    const out = parsePlanResponse(
      JSON.stringify({
        feature_slug: 'x',
        feature_title: 'X',
        clarifying_questions: [],
      }),
    );
    expect(out.affectedFlows).toEqual([]);
    expect(out.adjacentOpportunities).toEqual([]);
  });

  it('throws when JSON is malformed', () => {
    expect(() => parsePlanResponse('not json at all')).toThrow(
      /Could not parse the plan/,
    );
  });

  it('throws when required fields are missing', () => {
    expect(() => parsePlanResponse(JSON.stringify({}))).toThrow(
      /missing required fields/,
    );
  });
});
