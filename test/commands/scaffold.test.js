import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import scaffoldCommand from '../../src/commands/scaffold.js';

const SAMPLE_PLAN = {
  stack: 'Next.js + Postgres + Prisma',
  summary: 'Strong type safety.',
  directory_structure: '```\napp/\n```',
  initial_files: [
    { path: 'app/page.tsx', purpose: 'home route' },
    { path: 'prisma/schema.prisma', purpose: 'data model' },
    { path: 'README.md', purpose: 'project readme' },
  ],
  setup_commands: ['npx create-next-app@latest .', 'npm install @prisma/client'],
};

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function seedScaffold(dir, plan = SAMPLE_PLAN) {
  await mkdir(join(dir, '.draftwise'), { recursive: true });
  await writeFile(
    join(dir, '.draftwise', 'scaffold.json'),
    JSON.stringify(plan),
    'utf8',
  );
}

function fakePrompts(answer) {
  return { confirmScaffold: async () => answer };
}

const greenfieldConfig = async () => ({ projectState: 'greenfield' });
const brownfieldConfig = async () => ({ projectState: 'brownfield' });

describe('draft scaffold', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-scaffold-'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if .draftwise/ is missing', async () => {
    await expect(
      scaffoldCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Run `draft init` first/);
  });

  it('errors if scaffold.json is missing', async () => {
    await mkdir(join(dir, '.draftwise'));
    await expect(
      scaffoldCommand([], {
        cwd: dir,
        log: () => {},
        loadConfig: greenfieldConfig,
      }),
    ).rejects.toThrow(/scaffold\.json not found/);
  });

  it('short-circuits with a friendly hint when run on a brownfield project', async () => {
    // Seed a scaffold.json so a "missing-file" code path can't possibly fire —
    // we want to confirm the brownfield check happens BEFORE the file check.
    await seedScaffold(dir);
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: brownfieldConfig,
    });
    expect(logs.join('\n')).toContain('scaffold is greenfield-only');
    // Nothing should have been written.
    expect(await pathExists(join(dir, 'app/page.tsx'))).toBe(false);
  });

  it('errors if scaffold.json is malformed', async () => {
    await mkdir(join(dir, '.draftwise'));
    await writeFile(join(dir, '.draftwise', 'scaffold.json'), '{not json', 'utf8');
    await expect(
      scaffoldCommand([], {
        cwd: dir,
        log: () => {},
        loadConfig: greenfieldConfig,
      }),
    ).rejects.toThrow(/Failed to parse/);
  });

  it('does nothing when initial_files is empty', async () => {
    await seedScaffold(dir, { ...SAMPLE_PLAN, initial_files: [] });
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: greenfieldConfig,
      prompts: fakePrompts(true),
    });
    expect(logs.join('\n')).toContain('Nothing to do');
  });

  it('aborts cleanly when the user declines confirmation', async () => {
    await seedScaffold(dir);
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: greenfieldConfig,
      prompts: fakePrompts(false),
    });
    expect(logs.join('\n')).toContain('Aborted');
    expect(await pathExists(join(dir, 'app/page.tsx'))).toBe(false);
  });

  it('creates each initial file with placeholder content and prints setup commands', async () => {
    await seedScaffold(dir);
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: greenfieldConfig,
      prompts: fakePrompts(true),
    });

    expect(await pathExists(join(dir, 'app/page.tsx'))).toBe(true);
    expect(await pathExists(join(dir, 'prisma/schema.prisma'))).toBe(true);
    expect(await pathExists(join(dir, 'README.md'))).toBe(true);

    const tsx = await readFile(join(dir, 'app/page.tsx'), 'utf8');
    expect(tsx).toContain('TODO');
    expect(tsx).toContain('home route');

    const md = await readFile(join(dir, 'README.md'), 'utf8');
    expect(md.startsWith('# ')).toBe(true);

    const out = logs.join('\n');
    expect(out).toContain('+ created: app/page.tsx');
    expect(out).toContain('Setup commands');
    expect(out).toContain('npx create-next-app');
  });

  it('blocks file paths that escape the project root', async () => {
    await seedScaffold(dir, {
      ...SAMPLE_PLAN,
      initial_files: [
        { path: '../escape.txt', purpose: 'should not be written' },
        { path: '../../../etc/foo.txt', purpose: 'also blocked' },
        { path: 'src/legit.ts', purpose: 'this one is fine' },
      ],
    });

    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: greenfieldConfig,
      prompts: fakePrompts(true),
    });

    const out = logs.join('\n');
    expect(out).toContain('blocked (escapes project root): ../escape.txt');
    expect(out).toContain('blocked (escapes project root): ../../../etc/foo.txt');
    expect(out).toContain('+ created: src/legit.ts');
    expect(out).toMatch(/2 blocked/);

    // Sanity: the legit file landed; the escape attempts didn't.
    expect(await pathExists(join(dir, 'src/legit.ts'))).toBe(true);
    // Walk one level up to confirm escape didn't write anything.
    expect(await pathExists(join(dir, '..', 'escape.txt'))).toBe(false);
  });

  it('skips files that already exist instead of overwriting', async () => {
    await seedScaffold(dir);
    await mkdir(join(dir, 'app'), { recursive: true });
    await writeFile(join(dir, 'app/page.tsx'), 'existing content', 'utf8');

    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      loadConfig: greenfieldConfig,
      prompts: fakePrompts(true),
    });

    const tsx = await readFile(join(dir, 'app/page.tsx'), 'utf8');
    expect(tsx).toBe('existing content');
    expect(logs.join('\n')).toContain('skipped (exists): app/page.tsx');
  });

  describe('non-TTY (flags-driven)', () => {
    function noPrompts() {
      return {
        confirmScaffold: () => {
          throw new Error('inquirer prompt fired in non-TTY test');
        },
      };
    }

    it('--yes runs without prompting in non-TTY', async () => {
      await seedScaffold(dir);

      await scaffoldCommand(['--yes'], {
        cwd: dir,
        log: () => {},
        isInteractive: () => false,
        loadConfig: greenfieldConfig,
        prompts: noPrompts(),
      });

      const tsx = await readFile(join(dir, 'app/page.tsx'), 'utf8');
      expect(tsx).toContain('TODO');
    });

    it('errors in non-TTY without --yes', async () => {
      await seedScaffold(dir);

      await expect(
        scaffoldCommand([], {
          cwd: dir,
          log: () => {},
          isInteractive: () => false,
          loadConfig: greenfieldConfig,
          prompts: noPrompts(),
        }),
      ).rejects.toThrow(/Pass --yes to confirm/);
    });
  });
});
