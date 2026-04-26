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
