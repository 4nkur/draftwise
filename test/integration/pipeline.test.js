// End-to-end pipeline tests. Unlike the per-command unit tests, these don't
// inject loadConfig / scan / etc — every command runs against a real temp
// directory with a real config.yaml + fixture files. Catches cross-command
// seams the unit tests can't (e.g. init writing a config that subsequent
// commands fail to parse, list/show finding specs in the wrong shape).
//
// All commands run against a host coding agent — they print scanner data +
// instruction to stdout and let the agent do the writing. Nothing here calls
// an LLM directly.

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

import init from '../../src/commands/init.js';
import scan from '../../src/commands/scan.js';
import explain from '../../src/commands/explain.js';
import newCommand from '../../src/commands/new.js';
import list from '../../src/commands/list.js';
import show from '../../src/commands/show.js';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const FAKE_EXPRESS_APP = `
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('ok'));
app.post('/users', (req, res) => res.json({ ok: true }));
app.get('/healthz', (req, res) => res.send('ok'));

module.exports = app;
`;

const FAKE_PACKAGE_JSON = JSON.stringify(
  {
    name: 'integration-fixture',
    version: '0.0.0',
    dependencies: { express: '^4.18.0' },
  },
  null,
  2,
);

describe('integration: pipeline (brownfield)', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-int-bf-'));
    await writeFile(join(dir, 'package.json'), FAKE_PACKAGE_JSON, 'utf8');
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'index.js'), FAKE_EXPRESS_APP, 'utf8');
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function log(m) {
    logs.push(m);
  }

  it('init creates the .draftwise/ skeleton and a parseable config', async () => {
    await init([], { cwd: dir, log, isInteractive: () => false });

    expect(await exists(join(dir, '.draftwise'))).toBe(true);
    expect(await exists(join(dir, '.draftwise', 'specs'))).toBe(true);
    expect(await exists(join(dir, '.draftwise', 'overview.md'))).toBe(true);
    expect(await exists(join(dir, '.draftwise', 'config.yaml'))).toBe(true);
    expect(await exists(join(dir, '.draftwise', '.gitignore'))).toBe(true);

    const config = await readFile(
      join(dir, '.draftwise', 'config.yaml'),
      'utf8',
    );
    expect(config).toContain('state: brownfield');
    expect(config).not.toContain('ai:');
  });

  it('scan, explain, new — all reach correct agent-mode output', async () => {
    await init([], { cwd: dir, log, isInteractive: () => false });

    // scan dumps scanner output + instruction.
    logs.length = 0;
    await scan([], { cwd: dir, log });
    let out = logs.join('\n');
    expect(out).toContain('SCANNER OUTPUT');
    expect(out).toContain('INSTRUCTION');
    // Real scanner saw the express routes from the fixture.
    expect(out).toMatch(/POST.*\/users|"\/users"/);

    // explain — flow-keyword-filtered scanner output + instruction.
    logs.length = 0;
    await explain(['users'], { cwd: dir, log });
    out = logs.join('\n');
    expect(out).toContain('FLOW: users');
    expect(out).toContain('INSTRUCTION');

    // new — three-phase instruction for the host agent.
    logs.length = 0;
    await newCommand(['add', 'auth', 'middleware'], { cwd: dir, log });
    out = logs.join('\n');
    expect(out).toContain('IDEA: add auth middleware');
    expect(out).toContain('PHASE 1');
    expect(out).toContain('PHASE 2');
    expect(out).toContain('PHASE 3');
  });

  it('list and show find specs that the host agent would have written', async () => {
    await init([], { cwd: dir, log, isInteractive: () => false });

    // Agent doesn't write specs from inside draftwise — the host coding
    // agent does. Simulate that step by seeding spec files at the same
    // paths the agent would.
    const featureDir = join(dir, '.draftwise', 'specs', 'mute-notifications');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, 'product-spec.md'),
      '# Mute notifications\n\nProduct body.',
      'utf8',
    );
    await writeFile(
      join(featureDir, 'technical-spec.md'),
      '# Tech\n\nTechnical body.',
      'utf8',
    );
    await writeFile(
      join(featureDir, 'tasks.md'),
      '# Tasks\n\n1. First task',
      'utf8',
    );

    // list shows the seeded spec.
    logs.length = 0;
    await list([], { cwd: dir, log });
    const listOut = logs.join('\n');
    expect(listOut).toContain('mute-notifications');
    expect(listOut).toContain('Mute notifications');
    expect(listOut).toMatch(/product · tech · tasks/);

    // show product (default).
    logs.length = 0;
    await show(['mute-notifications'], { cwd: dir, log });
    expect(logs.join('\n')).toContain('# Mute notifications');

    // show tech.
    logs.length = 0;
    await show(['mute-notifications', 'tech'], { cwd: dir, log });
    expect(logs.join('\n')).toContain('Technical body');

    // show tasks.
    logs.length = 0;
    await show(['mute-notifications', 'tasks'], { cwd: dir, log });
    expect(logs.join('\n')).toContain('1. First task');
  });

  it('show errors gracefully when the requested type is missing', async () => {
    await init([], { cwd: dir, log, isInteractive: () => false });

    const featureDir = join(dir, '.draftwise', 'specs', 'half-baked');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, 'product-spec.md'),
      '# Half-baked',
      'utf8',
    );

    await expect(
      show(['half-baked', 'tech'], { cwd: dir, log }),
    ).rejects.toThrow(/technical-spec\.md not found/);
  });
});

describe('integration: pipeline (greenfield)', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-int-gf-'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function log(m) {
    logs.push(m);
  }

  it('init greenfield → scan / explain short-circuit cleanly', async () => {
    await init(
      ['--mode=greenfield', '--idea=a recipe sharing app for home cooks'],
      { cwd: dir, log, isInteractive: () => false },
    );

    expect(await exists(join(dir, '.draftwise', 'config.yaml'))).toBe(true);
    const config = await readFile(
      join(dir, '.draftwise', 'config.yaml'),
      'utf8',
    );
    expect(config).toContain('state: greenfield');

    const overview = await readFile(
      join(dir, '.draftwise', 'overview.md'),
      'utf8',
    );
    expect(overview).toContain('Greenfield plan');
    expect(overview).toContain('a recipe sharing app for home cooks');

    // scan in greenfield short-circuits — no scanner call, friendly hint.
    logs.length = 0;
    await scan([], { cwd: dir, log });
    expect(logs.join('\n')).toContain('No code yet');

    // explain in greenfield short-circuits the same way.
    logs.length = 0;
    await explain(['signup'], { cwd: dir, log });
    expect(logs.join('\n')).toContain('No code yet');
  });
});
