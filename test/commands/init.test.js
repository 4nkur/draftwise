import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import init from '../../src/commands/init.js';

function fakeScan(files) {
  return async (root) => ({ root, files });
}

const interactiveTrue = () => true;
const interactiveFalse = () => false;

const detectBrownfield = async () => 'brownfield';
const detectGreenfield = async () => 'greenfield';

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
        isInteractive: interactiveTrue,
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/already exists/);
  });

  describe('brownfield path (interactive)', () => {
    it('creates .draftwise/ skeleton in agent mode and saves project state', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({ mode: 'agent' }),
        isInteractive: interactiveTrue,
        detectProjectState: detectBrownfield,
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

      const gitignore = await readFile(join(drafts, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.cache/');
    });

    it('writes provider and api_key_env in api mode', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        prompts: makeBrownfieldPrompts({
          mode: 'api',
          provider: 'claude',
        }),
        isInteractive: interactiveTrue,
        detectProjectState: detectBrownfield,
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
        isInteractive: interactiveTrue,
        detectProjectState: detectBrownfield,
        scan: fakeScan(['src/foo.js']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('provider: openai');
      expect(config).toContain('api_key_env: WORK_OPENAI_KEY');
    });

    it('errors when --mode=brownfield is forced but the repo has no source files', async () => {
      // The user explicitly overrode auto-detection with --mode=brownfield
      // even though the repo is empty. Brownfield then bails on the scan.
      await expect(
        init(['--mode=brownfield'], {
          cwd: dir,
          log: () => {},
          prompts: makeBrownfieldPrompts({ mode: 'agent' }),
          isInteractive: interactiveTrue,
          scan: fakeScan([]),
        }),
      ).rejects.toThrow(/No source files/);
    });
  });

  describe('greenfield path (interactive)', () => {
    it('agent mode prints the conversation instruction and writes a placeholder', async () => {
      const logs = [];
      await init([], {
        cwd: dir,
        log: (m) => logs.push(m),
        prompts: makeGreenfieldPrompts({
          mode: 'agent',
          idea: 'a recipe sharing app for home cooks',
        }),
        isInteractive: interactiveTrue,
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
      expect(output).toContain('coding agent should pick this up');

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
        isInteractive: interactiveTrue,
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
        isInteractive: interactiveTrue,
        scan: fakeScan([]),
        complete: async () => '',
      });

      await access(join(dir, '.draftwise', 'overview.md'));
    });
  });

  describe('non-TTY (flags-driven)', () => {
    function noPrompts() {
      const fail = () => {
        throw new Error('inquirer prompt fired in non-TTY test');
      };
      return {
        promptProjectState: fail,
        promptMode: fail,
        promptProvider: fail,
        promptApiKeyEnv: fail,
        promptIdea: fail,
        askGreenfieldQuestion: fail,
        pickStack: fail,
      };
    }

    it('brownfield + agent runs end-to-end with flags only', async () => {
      await init(['--mode=brownfield', '--ai-mode=agent'], {
        cwd: dir,
        log: () => {},
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan(['src/foo.js']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('mode: agent');
      expect(config).toContain('state: brownfield');
    });

    it('brownfield + api with custom env var, no inquirer fired', async () => {
      await init(
        [
          '--mode=brownfield',
          '--ai-mode=api',
          '--provider=claude',
          '--api-key-env=MY_ANTHROPIC_KEY',
        ],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan(['src/foo.js']),
        },
      );

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('api_key_env: MY_ANTHROPIC_KEY');
    });

    it('api mode without --api-key-env defaults to provider standard env var', async () => {
      await init(
        ['--mode=brownfield', '--ai-mode=api', '--provider=claude'],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan(['src/foo.js']),
        },
      );

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('api_key_env: ANTHROPIC_API_KEY');
    });

    it('greenfield + agent + --idea writes the placeholder plan', async () => {
      await init(
        ['--mode=greenfield', '--ai-mode=agent', '--idea=A new idea'],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan([]),
          complete: async () => {
            throw new Error('should not be called in agent mode');
          },
        },
      );

      const overview = await readFile(
        join(dir, '.draftwise', 'overview.md'),
        'utf8',
      );
      expect(overview).toContain('A new idea');
    });

    it('greenfield + api + --idea + --stack runs end-to-end with no prompts', async () => {
      let callCount = 0;
      await init(
        [
          '--mode=greenfield',
          '--ai-mode=api',
          '--provider=claude',
          '--idea=a recipe sharing app',
          '--stack=Next.js + Postgres + Prisma',
        ],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan([]),
          complete: async () => {
            callCount++;
            if (callCount === 1) {
              return '```json\n' + JSON.stringify(SAMPLE_QUESTIONS) + '\n```';
            }
            return '```json\n' + JSON.stringify(SAMPLE_STACKS) + '\n```';
          },
        },
      );

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('Next.js + Postgres + Prisma');
    });

    it('greenfield + api with --answers @file populates the model prompt', async () => {
      const answersPath = join(dir, 'answers.json');
      await writeFile(
        answersPath,
        JSON.stringify(['Private', 'Mobile-first']),
        'utf8',
      );

      const captured = [];
      let callCount = 0;
      await init(
        [
          '--mode=greenfield',
          '--ai-mode=api',
          '--provider=claude',
          '--idea=a fitness app',
          `--answers=@${answersPath}`,
        ],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan([]),
          complete: async (req) => {
            captured.push(req);
            callCount++;
            if (callCount === 1) {
              return '```json\n' + JSON.stringify(SAMPLE_QUESTIONS) + '\n```';
            }
            return '```json\n' + JSON.stringify(SAMPLE_STACKS) + '\n```';
          },
        },
      );

      // Stack-options call should include the supplied answers
      expect(captured[1].prompt).toContain('Private');
      expect(captured[1].prompt).toContain('Mobile-first');
    });

    it('greenfield + api without --stack picks the first option', async () => {
      let callCount = 0;
      await init(
        [
          '--mode=greenfield',
          '--ai-mode=api',
          '--provider=claude',
          '--idea=a thing',
        ],
        {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan([]),
          complete: async () => {
            callCount++;
            if (callCount === 1) {
              return '```json\n' + JSON.stringify(SAMPLE_QUESTIONS) + '\n```';
            }
            return '```json\n' + JSON.stringify(SAMPLE_STACKS) + '\n```';
          },
        },
      );

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('Next.js + Postgres + Prisma');
    });

    it('prints the structured handoff when no flags supplied (instead of erroring)', async () => {
      const logs = [];
      await init([], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan(['src/foo.js']),
      });

      const out = logs.join('\n');
      expect(out).toContain('coding agent should pick this up');
      expect(out).toContain('INIT — answer these in chat');
      // Project state is auto-detected, not asked: empty dir → greenfield.
      expect(out).toContain('Detected: new project');
      // AI mode + provider + idea are still open questions.
      expect(out).toContain('AI mode');
      expect(out).toContain('AI provider');
      expect(out).toContain('What do you want to build');
      expect(out).toContain('INSTRUCTION');
      expect(out).toContain('draftwise init --ai-mode=');

      // No files written — init bailed before scanning or writing.
      await expect(
        readFile(join(dir, '.draftwise', 'config.yaml'), 'utf8'),
      ).rejects.toThrow();
    });

    it('handoff omits questions for fields already supplied', async () => {
      const logs = [];
      await init(['--mode=brownfield'], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan(['src/foo.js']),
      });

      const out = logs.join('\n');
      // Only --ai-mode is missing — handoff should ask for that and not for
      // idea (irrelevant once mode=brownfield). Project state was set via
      // --mode flag, so it's announced in the orienting line, not asked.
      expect(out).toContain('AI mode');
      expect(out).toContain('Project state set via --mode');
      expect(out).not.toContain('What do you want to build');
    });

    it('handoff fires when api + non-TTY + no --provider', async () => {
      const logs = [];
      await init(['--mode=brownfield', '--ai-mode=api'], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan(['src/foo.js']),
      });

      const out = logs.join('\n');
      expect(out).toContain('AI provider');
      expect(out).toContain('Project state set via --mode');
      // AI mode question (em-dash form) is not asked — flag was supplied.
      expect(out).not.toContain('AI mode —');
    });

    it('handoff fires when greenfield + non-TTY + no --idea', async () => {
      const logs = [];
      await init(['--mode=greenfield', '--ai-mode=agent'], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan([]),
      });

      const out = logs.join('\n');
      expect(out).toContain('What do you want to build');
      expect(out).toContain('Project state set via --mode');
    });

    it('still throws (does NOT handoff) on a .draftwise/ that already exists', async () => {
      await mkdir(join(dir, '.draftwise'));
      await expect(
        init([], {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan(['src/foo.js']),
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('rejects --mode with an invalid value', async () => {
      await expect(
        init(['--mode=halffield', '--ai-mode=agent'], {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan([]),
        }),
      ).rejects.toThrow(/Invalid --mode value/);
    });

    it('rejects unknown flags via parseArgs strict mode', async () => {
      await expect(
        init(['--mode=brownfield', '--ai-mode=agent', '--bogus=yes'], {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan(['src/foo.js']),
        }),
      ).rejects.toThrow(/Invalid arguments to draftwise init/);
    });

    it('rejects --stack that does not match any proposed option', async () => {
      let callCount = 0;
      await expect(
        init(
          [
            '--mode=greenfield',
            '--ai-mode=api',
            '--provider=claude',
            '--idea=a thing',
            '--stack=NotARealStack',
          ],
          {
            cwd: dir,
            log: () => {},
            isInteractive: interactiveFalse,
            prompts: noPrompts(),
            scan: fakeScan([]),
            complete: async () => {
              callCount++;
              if (callCount === 1) {
                return '```json\n' + JSON.stringify(SAMPLE_QUESTIONS) + '\n```';
              }
              return '```json\n' + JSON.stringify(SAMPLE_STACKS) + '\n```';
            },
          },
        ),
      ).rejects.toThrow(/--stack "NotARealStack" doesn't match/);
    });
  });

  describe('auto-detect project state', () => {
    it('auto-detects brownfield from on-disk source files when --mode is omitted', async () => {
      // Seed a real source file so the default detector returns brownfield.
      await writeFile(join(dir, 'index.ts'), 'export {};', 'utf8');

      const logs = [];
      await init(['--ai-mode=agent'], {
        cwd: dir,
        log: (m) => logs.push(m),
        // Use the real detector — no detectProjectState injection.
        prompts: makeBrownfieldPrompts({ mode: 'agent' }),
        isInteractive: interactiveTrue,
        scan: fakeScan(['index.ts']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('state: brownfield');
      const out = logs.join('\n');
      expect(out).toContain('Detected: existing codebase');
      expect(out).toContain('Override with --mode=greenfield');
    });

    it('auto-detects greenfield when the cwd has no source files', async () => {
      // Empty dir — no source files anywhere. Real detector returns greenfield.
      const logs = [];
      await init(['--ai-mode=agent', '--idea=a thing'], {
        cwd: dir,
        log: (m) => logs.push(m),
        prompts: makeGreenfieldPrompts({
          mode: 'agent',
          idea: 'a thing',
        }),
        isInteractive: interactiveTrue,
        scan: fakeScan([]),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('state: greenfield');
      const out = logs.join('\n');
      expect(out).toContain('Detected: new project');
      expect(out).toContain('Override with --mode=brownfield');
    });

    it('--mode flag wins over filesystem detection', async () => {
      // Seed source files but force greenfield via flag.
      await writeFile(join(dir, 'app.py'), 'print(1)', 'utf8');

      const logs = [];
      await init(
        ['--mode=greenfield', '--ai-mode=agent', '--idea=a thing'],
        {
          cwd: dir,
          log: (m) => logs.push(m),
          prompts: makeGreenfieldPrompts({
            mode: 'agent',
            idea: 'a thing',
          }),
          isInteractive: interactiveTrue,
          scan: fakeScan(['app.py']),
        },
      );

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('state: greenfield');
      // No "Detected:" line when the user supplied --mode explicitly.
      expect(logs.join('\n')).not.toContain('Detected:');
    });
  });
});
