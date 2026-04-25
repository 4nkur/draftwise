import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import init from '../../src/commands/init.js';

function fakeScan(files) {
  return async (root) => ({ root, files });
}

function makeBrownfieldPrompts({ mode, provider, apiKeyEnv } = {}) {
  return {
    promptProjectState: async () => 'brownfield',
    promptMode: async () => mode,
    promptProvider: async () => provider,
    promptApiKeyEnv: async ({ suggested }) => apiKeyEnv ?? suggested,
  };
}

function makeGreenfieldPrompts({
  mode,
  provider,
  apiKeyEnv,
  idea,
  answers = [],
  pickedStack,
}) {
  let qIndex = 0;
  return {
    promptProjectState: async () => 'greenfield',
    promptMode: async () => mode,
    promptProvider: async () => provider,
    promptApiKeyEnv: async ({ suggested }) => apiKeyEnv ?? suggested,
    promptIdea: async () => idea,
    askGreenfieldQuestion: async () => answers[qIndex++] ?? '',
    pickStack: async () => pickedStack,
  };
}

const SAMPLE_QUESTIONS = {
  project_title: 'Recipe sharing app',
  questions: [
    { text: 'Public or private recipes?', why: 'auth/sharing model' },
    { text: 'Mobile-first or web-first?', why: 'frontend choice' },
  ],
};

const SAMPLE_STACKS = {
  stack_options: [
    {
      name: 'Next.js + Postgres + Prisma',
      summary: 'Full-stack web with strong type safety.',
      rationale: 'You said web-first; Next gives SSR + API routes in one repo.',
      pros: ['One framework, one deploy', 'Great DX with Prisma'],
      cons: ['React learning curve', 'Vercel coupling on hosting'],
      directory_structure: '```\napp/\n├── page.tsx\n└── api/\n```',
      initial_files: [
        { path: 'app/page.tsx', purpose: 'home route' },
      ],
      setup_commands: ['npx create-next-app@latest .'],
    },
    {
      name: 'Remix + Postgres + Drizzle',
      summary: 'Web-standards-first stack.',
      rationale: 'Form-heavy app — Remix actions are a clean fit.',
      pros: ['Web fundamentals', 'No hidden magic'],
      cons: ['Smaller ecosystem'],
      directory_structure: '```\napp/\n└── routes/\n```',
      initial_files: [],
      setup_commands: ['npx create-remix@latest'],
    },
  ],
};

describe('draftwise init', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-init-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ already exists', async () => {
    await mkdir(join(dir, '.draftwise'));

    await expect(
      init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({ mode: 'agent' }),
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/already exists/);
  });

  describe('brownfield path', () => {
    it('creates .draftwise/ skeleton in agent mode and saves project state', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({ mode: 'agent' }),
        scan: fakeScan(['src/foo.js', 'src/bar.ts']),
      });

      const drafts = join(dir, '.draftwise');
      await access(drafts);
      await access(join(drafts, 'specs'));

      const overview = await readFile(join(drafts, 'overview.md'), 'utf8');
      expect(overview).toContain('Codebase overview');

      const config = await readFile(join(drafts, 'config.yaml'), 'utf8');
      expect(config).toContain('mode: agent');
      expect(config).toContain('state: brownfield');
      expect(config).not.toContain('provider:');
    });

    it('writes provider and api_key_env in api mode', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({
          mode: 'api',
          provider: 'claude',
        }),
        scan: fakeScan(['src/foo.js']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('mode: api');
      expect(config).toContain('provider: claude');
      expect(config).toContain('api_key_env: ANTHROPIC_API_KEY');
      expect(config).toContain('state: brownfield');
    });

    it('respects a custom api_key_env name', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({
          mode: 'api',
          provider: 'openai',
          apiKeyEnv: 'WORK_OPENAI_KEY',
        }),
        scan: fakeScan(['src/foo.js']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('provider: openai');
      expect(config).toContain('api_key_env: WORK_OPENAI_KEY');
    });

    it('errors when the repo has no source files', async () => {
      await expect(
        init([], {
          cwd: dir,
          log: () => {},
          prompts: makeBrownfieldPrompts({ mode: 'agent' }),
          scan: fakeScan([]),
        }),
      ).rejects.toThrow(/No source files/);
    });
  });

  describe('greenfield path', () => {
    it('agent mode prints the conversation instruction and writes a placeholder', async () => {
      const logs = [];
      await init([], {
        cwd: dir,
        log: (m) => logs.push(m),
        prompts: makeGreenfieldPrompts({
          mode: 'agent',
          idea: 'a recipe sharing app for home cooks',
        }),
        scan: fakeScan([]),
        complete: async () => {
          throw new Error('should not be called in agent mode');
        },
      });

      const output = logs.join('\n');
      expect(output).toContain('IDEA: a recipe sharing app for home cooks');
      expect(output).toContain('PHASE 1');
      expect(output).toContain('PHASE 2');
      expect(output).toContain('PHASE 3');

      const overview = await readFile(
        join(dir, '.draftwise', 'overview.md'),
        'utf8',
      );
      expect(overview).toContain('Greenfield plan — placeholder');
      expect(overview).toContain('a recipe sharing app for home cooks');

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('mode: agent');
      expect(config).toContain('state: greenfield');
      expect(config).not.toContain('stack:');
    });

    it('api mode walks questions, picks a stack, and writes the full plan', async () => {
      let callCount = 0;
      const captured = [];
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeGreenfieldPrompts({
          mode: 'api',
          provider: 'claude',
          apiKeyEnv: 'ANTHROPIC_API_KEY',
          idea: 'a recipe sharing app for home cooks',
          answers: ['Public', 'Web-first'],
          pickedStack: 'Next.js + Postgres + Prisma',
        }),
        scan: fakeScan([]),
        complete: async (req) => {
          callCount++;
          captured.push(req);
          if (callCount === 1) {
            return '```json\n' + JSON.stringify(SAMPLE_QUESTIONS) + '\n```';
          }
          return '```json\n' + JSON.stringify(SAMPLE_STACKS) + '\n```';
        },
      });

      expect(callCount).toBe(2);
      expect(captured[0].system).toContain('clarifying questions');
      expect(captured[0].prompt).toContain(
        'a recipe sharing app for home cooks',
      );
      expect(captured[1].system).toContain('2-3 stack options');
      expect(captured[1].prompt).toContain('Recipe sharing app');
      expect(captured[1].prompt).toContain('Public');

      const overview = await readFile(
        join(dir, '.draftwise', 'overview.md'),
        'utf8',
      );
      expect(overview).toContain('Recipe sharing app');
      expect(overview).toContain('Next.js + Postgres + Prisma');
      expect(overview).toContain('Public');
      expect(overview).toContain('npx create-next-app');
      expect(overview).toContain('### Pros');
      expect(overview).toContain('### Cons');

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('state: greenfield');
      expect(config).toContain('Next.js + Postgres + Prisma');

      const scaffoldRaw = await readFile(
        join(dir, '.draftwise', 'scaffold.json'),
        'utf8',
      );
      const scaffold = JSON.parse(scaffoldRaw);
      expect(scaffold.stack).toBe('Next.js + Postgres + Prisma');
      expect(scaffold.initial_files).toHaveLength(1);
      expect(scaffold.setup_commands).toContain('npx create-next-app@latest .');
    });

    it('does NOT require source files (empty repo is fine)', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeGreenfieldPrompts({
          mode: 'agent',
          idea: 'a brand new idea',
        }),
        scan: fakeScan([]),
        complete: async () => '',
      });

      await access(join(dir, '.draftwise', 'overview.md'));
    });
  });
});
