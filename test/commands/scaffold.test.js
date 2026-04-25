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

describe('draftwise scaffold', () => {
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
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('errors if scaffold.json is missing', async () => {
    await mkdir(join(dir, '.draftwise'));
    await expect(
      scaffoldCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/scaffold\.json not found/);
  });

  it('errors if scaffold.json is malformed', async () => {
    await mkdir(join(dir, '.draftwise'));
    await writeFile(join(dir, '.draftwise', 'scaffold.json'), '{not json', 'utf8');
    await expect(
      scaffoldCommand([], { cwd: dir, log: () => {} }),
    ).rejects.toThrow(/Failed to parse/);
  });

  it('does nothing when initial_files is empty', async () => {
    await seedScaffold(dir, { ...SAMPLE_PLAN, initial_files: [] });
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      prompts: fakePrompts(true),
    });
    expect(logs.join('\n')).toContain('Nothing to do');
  });

  it('aborts cleanly when the user declines confirmation', async () => {
    await seedScaffold(dir);
    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
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

  it('skips files that already exist instead of overwriting', async () => {
    await seedScaffold(dir);
    await mkdir(join(dir, 'app'), { recursive: true });
    await writeFile(join(dir, 'app/page.tsx'), 'existing content', 'utf8');

    await scaffoldCommand([], {
      cwd: dir,
      log: (m) => logs.push(m),
      prompts: fakePrompts(true),
    });

    const tsx = await readFile(join(dir, 'app/page.tsx'), 'utf8');
    expect(tsx).toBe('existing content');
    expect(logs.join('\n')).toContain('skipped (exists): app/page.tsx');
  });
});
