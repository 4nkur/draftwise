import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import newCommand from '../../src/commands/new.js';

const SAMPLE_SCAN = {
  root: '/repo',
  files: ['src/api/albums.ts', 'src/components/AlbumGrid.tsx'],
  packageMeta: {
    name: 'photos',
    dependencies: ['next', '@prisma/client'],
    devDependencies: [],
  },
  frameworks: ['Next.js'],
  orms: ['Prisma'],
  routes: [{ method: 'GET', path: '/albums', file: 'src/api/albums.ts' }],
  components: [{ name: 'AlbumGrid', file: 'src/components/AlbumGrid.tsx' }],
  models: [{ name: 'Album', file: 'prisma/schema.prisma', fields: ['id', 'title'] }],
};

const SAMPLE_PLAN = {
  feature_slug: 'collab-albums',
  feature_title: 'Collaborative Albums',
  affected_flows: [
    {
      name: 'album-create',
      files: ['src/api/albums.ts'],
      impact: 'now accepts collaborator IDs',
    },
  ],
  clarifying_questions: [
    { text: 'Who can invite?', why: 'permissions are unclear' },
    { text: 'Notification on invite?', why: 'no notification system in scanner' },
  ],
  adjacent_opportunities: [
    {
      flow: 'sharing',
      suggestion: 'unify share + invite',
      rationale: 'avoid drift',
    },
  ],
};

function fakePrompts({ answers, decisions }) {
  let qIndex = 0;
  let dIndex = 0;
  return {
    askQuestion: async () => answers[qIndex++],
    decideOpportunity: async () => decisions[dIndex++],
  };
}

describe('draftwise new', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-new-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if no idea was given', async () => {
    await expect(
      newCommand([], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Missing idea/);
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      newCommand(['add', 'collaborative', 'albums'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('agent mode dumps scanner data + idea + 3-phase instruction without writing the spec', async () => {
    await newCommand(['add', 'collab', 'albums'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ mode: 'agent' }),
      complete: async () => {
        throw new Error('should not be called in agent mode');
      },
    });

    const output = logs.join('\n');
    expect(output).toContain('IDEA: add collab albums');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('PHASE 1');
    expect(output).toContain('PHASE 2');
    expect(output).toContain('PHASE 3');
    expect(output).toContain('coding agent should pick this up');

    await expect(
      readFile(join(dir, '.draftwise', 'specs', 'collab-albums', 'product-spec.md')),
    ).rejects.toThrow();
  });

  it('api mode walks the user through Q&A then writes the spec', async () => {
    let callCount = 0;
    const captured = [];
    await newCommand(['add', 'collab', 'albums'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async (req) => {
        callCount++;
        captured.push(req);
        if (callCount === 1) {
          return '```json\n' + JSON.stringify(SAMPLE_PLAN) + '\n```';
        }
        return '# Collaborative Albums\n\nFinal spec body.';
      },
      prompts: fakePrompts({
        answers: ['Anyone in the album', 'Yes — email + in-app'],
        decisions: ['accepted'],
      }),
    });

    expect(callCount).toBe(2);
    expect(captured[0].system).toContain('plan the conversation');
    expect(captured[1].system).toContain('product-spec.md');
    expect(captured[1].prompt).toContain('Anyone in the album');
    expect(captured[1].prompt).toContain('"decision": "accepted"');
    // The synthesis call (#1) streams; the plan call (#0) does not.
    expect(typeof captured[1].onToken).toBe('function');
    expect(captured[0].onToken).toBeUndefined();

    const spec = await readFile(
      join(dir, '.draftwise', 'specs', 'collab-albums', 'product-spec.md'),
      'utf8',
    );
    expect(spec).toContain('# Collaborative Albums');
  });

  it('api mode handles plans with no adjacent opportunities', async () => {
    const planWithoutOpportunities = {
      ...SAMPLE_PLAN,
      adjacent_opportunities: [],
    };

    let callCount = 0;
    await newCommand(['idea'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return JSON.stringify(planWithoutOpportunities);
        }
        return '# Spec\n';
      },
      prompts: fakePrompts({
        answers: ['', ''],
        decisions: [],
      }),
    });

    expect(callCount).toBe(2);
    const spec = await readFile(
      join(dir, '.draftwise', 'specs', 'collab-albums', 'product-spec.md'),
      'utf8',
    );
    expect(spec).toContain('# Spec');
  });

  it('prompts before overwriting an existing product-spec.md, and bails if user declines', async () => {
    // Pre-seed the spec dir with a hand-edited file the user would lose.
    const specDir = join(dir, '.draftwise', 'specs', 'collab-albums');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      join(specDir, 'product-spec.md'),
      '# Hand-edited product spec\n',
      'utf8',
    );

    let callCount = 0;
    let promptCalls = 0;

    await newCommand(['add', 'collab', 'albums'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return '```json\n' + JSON.stringify(SAMPLE_PLAN) + '\n```';
        }
        // Synthesis call must NOT fire when the user declines overwrite.
        throw new Error('synthesis call should not happen when user cancels');
      },
      prompts: {
        ...fakePrompts({ answers: [], decisions: [] }),
        confirmOverwrite: async () => {
          promptCalls++;
          return false;
        },
      },
    });

    expect(callCount).toBe(1); // plan only, no synthesis
    expect(promptCalls).toBe(1);
    expect(logs.join('\n')).toContain('Cancelled');

    const spec = await readFile(join(specDir, 'product-spec.md'), 'utf8');
    expect(spec).toBe('# Hand-edited product spec\n');
  });

  it('overwrites product-spec.md when user confirms the prompt', async () => {
    const specDir = join(dir, '.draftwise', 'specs', 'collab-albums');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      join(specDir, 'product-spec.md'),
      '# Old product spec\n',
      'utf8',
    );

    let callCount = 0;

    await newCommand(['add', 'collab', 'albums'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return JSON.stringify(SAMPLE_PLAN);
        }
        return '# Regenerated product spec';
      },
      prompts: {
        ...fakePrompts({
          answers: ['Anyone in the album', 'Yes'],
          decisions: ['declined'],
        }),
        confirmOverwrite: async () => true,
      },
    });

    expect(callCount).toBe(2);
    const spec = await readFile(join(specDir, 'product-spec.md'), 'utf8');
    expect(spec).toBe('# Regenerated product spec');
  });

  it('overwrites product-spec.md without prompting when --force is passed', async () => {
    const specDir = join(dir, '.draftwise', 'specs', 'collab-albums');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      join(specDir, 'product-spec.md'),
      '# Old',
      'utf8',
    );

    let callCount = 0;
    let promptCalls = 0;

    await newCommand(['--force', 'add', 'collab', 'albums'], {
      cwd: dir,
      log: () => {},
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
      }),
      complete: async () => {
        callCount++;
        if (callCount === 1) return JSON.stringify(SAMPLE_PLAN);
        return '# Regenerated';
      },
      prompts: {
        ...fakePrompts({
          answers: ['', ''],
          decisions: ['declined'],
        }),
        confirmOverwrite: async () => {
          promptCalls++;
          return false;
        },
      },
    });

    expect(promptCalls).toBe(0);
    expect(callCount).toBe(2);
    const spec = await readFile(join(specDir, 'product-spec.md'), 'utf8');
    expect(spec).toBe('# Regenerated');
  });

  it('greenfield api mode: skips scanner, reads overview, calls greenfield prompts', async () => {
    let scanCalled = false;
    let callCount = 0;
    const captured = [];

    const greenfieldPlan = {
      feature_slug: 'recipe-uploads',
      feature_title: 'Recipe Uploads',
      clarifying_questions: [
        { text: 'Photos required?', why: 'data model decision' },
      ],
    };

    await newCommand(['add', 'recipe', 'uploads'], {
      cwd: dir,
      log: () => {},
      scan: async () => {
        scanCalled = true;
        return SAMPLE_SCAN;
      },
      loadConfig: async () => ({
        mode: 'api',
        provider: 'claude',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        model: '',
        projectState: 'greenfield',
      }),
      readOverview: async () => '# Recipe app — Greenfield plan\n\nNext.js + Postgres + Prisma\n',
      complete: async (req) => {
        callCount++;
        captured.push(req);
        if (callCount === 1) return JSON.stringify(greenfieldPlan);
        return '# Recipe Uploads\n\nGreenfield spec body.';
      },
      prompts: fakePrompts({ answers: ['Yes'], decisions: [] }),
    });

    expect(scanCalled).toBe(false);
    expect(callCount).toBe(2);
    expect(captured[0].system).toContain('GREENFIELD');
    expect(captured[0].prompt).toContain('Recipe app');
    expect(captured[1].system).toContain('GREENFIELD');
    expect(captured[1].prompt).not.toContain('"affected_flows"');

    const spec = await readFile(
      join(dir, '.draftwise', 'specs', 'recipe-uploads', 'product-spec.md'),
      'utf8',
    );
    expect(spec).toContain('# Recipe Uploads');
  });

  it('greenfield agent mode: dumps PROJECT PLAN instead of SCANNER OUTPUT', async () => {
    const localLogs = [];
    await newCommand(['recipe', 'app'], {
      cwd: dir,
      log: (m) => localLogs.push(m),
      scan: async () => {
        throw new Error('scan should not be called in greenfield');
      },
      loadConfig: async () => ({
        mode: 'agent',
        projectState: 'greenfield',
      }),
      readOverview: async () => '# Recipe app — Greenfield plan\n',
      complete: async () => {
        throw new Error('complete should not be called in agent mode');
      },
    });

    const out = localLogs.join('\n');
    expect(out).toContain('PROJECT PLAN');
    expect(out).not.toContain('SCANNER OUTPUT');
    expect(out).toContain('Recipe app');
  });

  it('greenfield: errors if overview.md is empty', async () => {
    await expect(
      newCommand(['feature'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({
          mode: 'agent',
          projectState: 'greenfield',
        }),
        readOverview: async () => '',
        complete: async () => '',
      }),
    ).rejects.toThrow(/overview\.md is missing or empty/);
  });

  describe('non-TTY (flags-driven)', () => {
    function noPrompts() {
      const fail = () => {
        throw new Error('inquirer prompt fired in non-TTY test');
      };
      return {
        askQuestion: fail,
        decideOpportunity: fail,
        confirmOverwrite: fail,
      };
    }

    it('runs end-to-end with --answers, no prompts fired', async () => {
      let callCount = 0;
      const captured = [];
      await newCommand(
        [
          'add',
          'collab',
          'albums',
          '--answers',
          JSON.stringify(['Anyone in the album', 'Yes']),
        ],
        {
          cwd: dir,
          log: () => {},
          isInteractive: () => false,
          prompts: noPrompts(),
          scan: async () => SAMPLE_SCAN,
          loadConfig: async () => ({
            mode: 'api',
            provider: 'claude',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
            model: '',
          }),
          complete: async (req) => {
            callCount++;
            captured.push(req);
            if (callCount === 1) return JSON.stringify(SAMPLE_PLAN);
            return '# Spec body\n';
          },
        },
      );

      expect(callCount).toBe(2);
      expect(captured[1].prompt).toContain('Anyone in the album');
      // Adjacent opportunity declined automatically in non-TTY
      expect(captured[1].prompt).toContain('"decision": "declined"');
    });

    it('runs without --answers, leaves questions blank and declines opportunities', async () => {
      let callCount = 0;
      const captured = [];
      await newCommand(['idea'], {
        cwd: dir,
        log: () => {},
        isInteractive: () => false,
        prompts: noPrompts(),
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({
          mode: 'api',
          provider: 'claude',
          apiKeyEnv: 'ANTHROPIC_API_KEY',
          model: '',
        }),
        complete: async (req) => {
          callCount++;
          captured.push(req);
          if (callCount === 1) return JSON.stringify(SAMPLE_PLAN);
          return '# Spec\n';
        },
      });

      expect(callCount).toBe(2);
      expect(captured[1].prompt).toContain('"decision": "declined"');
    });

    it('errors when product-spec.md exists in non-TTY without --force', async () => {
      const specDir = join(dir, '.draftwise', 'specs', 'collab-albums');
      await mkdir(specDir, { recursive: true });
      await writeFile(join(specDir, 'product-spec.md'), '# existing\n', 'utf8');

      let callCount = 0;
      await expect(
        newCommand(['add', 'collab', 'albums'], {
          cwd: dir,
          log: () => {},
          isInteractive: () => false,
          prompts: noPrompts(),
          scan: async () => SAMPLE_SCAN,
          loadConfig: async () => ({
            mode: 'api',
            provider: 'claude',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
            model: '',
          }),
          complete: async () => {
            callCount++;
            return JSON.stringify(SAMPLE_PLAN);
          },
        }),
      ).rejects.toThrow(/already exists\. Pass --force/);

      // Plan ran but synthesis didn't.
      expect(callCount).toBe(1);
    });

    it('rejects --answers with bad JSON', async () => {
      await expect(
        newCommand(['idea', '--answers=not-json{'], {
          cwd: dir,
          log: () => {},
          isInteractive: () => false,
          prompts: noPrompts(),
          scan: async () => SAMPLE_SCAN,
          loadConfig: async () => ({
            mode: 'api',
            provider: 'claude',
            apiKeyEnv: 'ANTHROPIC_API_KEY',
            model: '',
          }),
          complete: async () => JSON.stringify(SAMPLE_PLAN),
        }),
      ).rejects.toThrow(/--answers must be a JSON array/);
    });
  });
});
