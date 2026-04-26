import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import run from '../src/index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

describe('draftwise CLI router', () => {
  let logs;
  let errs;
  let exitCalls;
  let originalLog;
  let originalErr;
  let originalExit;

  beforeEach(() => {
    logs = [];
    errs = [];
    exitCalls = [];
    originalLog = console.log;
    originalErr = console.error;
    originalExit = process.exit;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => errs.push(args.join(' '));
    process.exit = (code) => {
      exitCalls.push(code);
      // Throw so the rest of run() doesn't keep executing in tests.
      throw new Error(`__exit__:${code}`);
    };
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalErr;
    process.exit = originalExit;
  });

  it('prints the package.json version for --version', async () => {
    await run(['--version']);
    expect(logs.join('\n')).toBe(pkg.version);
  });

  it('prints the version for -v as well', async () => {
    await run(['-v']);
    expect(logs.join('\n')).toBe(pkg.version);
  });

  it('prints the version for the bare "version" command', async () => {
    await run(['version']);
    expect(logs.join('\n')).toBe(pkg.version);
  });

  it('prints top-level HELP when called with no args', async () => {
    await run([]);
    expect(logs.join('\n')).toContain('codebase-aware spec drafting');
    expect(logs.join('\n')).toContain('--version');
  });

  it('prints per-command HELP when called with --help after a command', async () => {
    await run(['init', '--help']);
    expect(logs.join('\n')).toContain('draftwise init');
    expect(logs.join('\n')).toContain('greenfield');
  });

  it('prints per-command HELP for -h after a command', async () => {
    await run(['explain', '-h']);
    expect(logs.join('\n')).toContain('draftwise explain');
    expect(logs.join('\n')).toContain('Walks the flow');
  });

  it('exits non-zero on unknown commands and shows top-level HELP', async () => {
    await expect(run(['bogus'])).rejects.toThrow(/__exit__:1/);
    expect(errs.join('\n')).toContain('Unknown command: bogus');
  });
});

describe('HELP consistency between top-level and per-command', () => {
  // Each command's HELP starts with "draftwise <cmd> — <one-liner>".
  // The top-level HELP listing should describe each command in a way that
  // doesn't drift from that one-liner. This catches accidental drift —
  // not full string equality, just that meaningful keywords from the
  // per-command summary appear in the top-level listing.
  const cases = [
    { cmd: 'init', mod: '../src/commands/init.js', mustInclude: ['greenfield', 'brownfield'] },
    { cmd: 'scaffold', mod: '../src/commands/scaffold.js', mustInclude: ['greenfield'] },
    { cmd: 'scan', mod: '../src/commands/scan.js', mustInclude: ['overview'] },
    { cmd: 'explain', mod: '../src/commands/explain.js', mustInclude: ['flow'] },
    { cmd: 'new', mod: '../src/commands/new.js', mustInclude: ['idea', 'product-spec'] },
    { cmd: 'tech', mod: '../src/commands/tech.js', mustInclude: ['technical-spec'] },
    { cmd: 'tasks', mod: '../src/commands/tasks.js', mustInclude: ['tasks.md', 'technical spec'] },
    { cmd: 'list', mod: '../src/commands/list.js', mustInclude: ['specs'] },
    { cmd: 'show', mod: '../src/commands/show.js', mustInclude: ['spec'] },
  ];

  for (const { cmd, mod, mustInclude } of cases) {
    it(`${cmd}: per-command HELP starts with the right header`, async () => {
      const m = await import(mod);
      expect(typeof m.HELP).toBe('string');
      expect(m.HELP.split('\n')[0]).toContain(`draftwise ${cmd}`);
    });

    it(`${cmd}: per-command HELP and top-level HELP agree on key concepts`, async () => {
      const m = await import(mod);
      const helpModule = await import('../src/index.js');
      // Trigger top-level HELP capture.
      const captured = [];
      const originalLog = console.log;
      console.log = (...args) => captured.push(args.join(' '));
      try {
        await helpModule.default([]);
      } finally {
        console.log = originalLog;
      }
      const topLevelHelp = captured.join('\n');
      const perCommandHelp = m.HELP;

      // Each "must include" keyword should appear in BOTH descriptions
      // — drifting one without the other will trip this.
      for (const keyword of mustInclude) {
        expect(perCommandHelp.toLowerCase()).toContain(keyword.toLowerCase());
        expect(topLevelHelp.toLowerCase()).toContain(keyword.toLowerCase());
      }
    });
  }
});
