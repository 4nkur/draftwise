import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import explainCommand from '../../src/commands/explain.js';

const SAMPLE_SCAN = {
  root: '/repo',
  files: ['src/index.js', 'src/auth/login.js'],
  packageMeta: { name: 'demo', dependencies: ['express'], devDependencies: [] },
  frameworks: ['Express'],
  orms: [],
  routes: [{ method: 'POST', path: '/login', file: 'src/auth/login.js' }],
  components: [],
  models: [],
};

describe('draftwise explain', () => {
  let dir;
  let logs;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'draftwise-explain-'));
    await mkdir(join(dir, '.draftwise'));
    logs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('errors if no flow name was given', async () => {
    await expect(
      explainCommand([], {
        cwd: dir,
        log: (m) => logs.push(m),
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Missing flow name/);
  });

  it('errors if .draftwise/ is missing', async () => {
    await rm(join(dir, '.draftwise'), { recursive: true });
    await expect(
      explainCommand(['login'], {
        cwd: dir,
        log: () => {},
        scan: async () => SAMPLE_SCAN,
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/Run `draftwise init` first/);
  });

  it('joins multi-word flow args before slugifying', async () => {
    await explainCommand(['user', 'signup'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ mode: 'agent' }),
      complete: async () => 'unused',
    });

    const output = logs.join('\n');
    expect(output).toContain('FLOW: user signup');
    expect(output).toContain('user-signup.md');
  });

  it('agent mode: prints scanner data + flow + instruction without writing the snapshot', async () => {
    await explainCommand(['login'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => SAMPLE_SCAN,
      loadConfig: async () => ({ mode: 'agent' }),
      complete: async () => {
        throw new Error('should not be called in agent mode');
      },
    });

    const output = logs.join('\n');
    expect(output).toContain('FLOW: login');
    expect(output).toContain('SCANNER OUTPUT');
    expect(output).toContain('Express');
    expect(output).toContain('INSTRUCTION');
    expect(output).toContain('coding agent should pick this up');

    await expect(
      readFile(join(dir, '.draftwise', 'flows', 'login.md')),
    ).rejects.toThrow();
  });

  it('api mode: calls the model, prints the walkthrough, and writes the snapshot', async () => {
    let captured;
    await explainCommand(['login'], {
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
        captured = req;
        return '# Flow: login\n\nGenerated walkthrough.';
      },
    });

    expect(captured.system).toContain('Draftwise');
    expect(captured.prompt).toContain('"login"');
    expect(captured.prompt).toContain('Express');
    // explain wires onToken so the walkthrough streams to stdout live.
    expect(typeof captured.onToken).toBe('function');

    const saved = await readFile(
      join(dir, '.draftwise', 'flows', 'login.md'),
      'utf8',
    );
    expect(saved).toContain('# Flow: login');
  });

  it('short-circuits in greenfield mode with a friendly message', async () => {
    let scanCalled = false;
    await explainCommand(['login'], {
      cwd: dir,
      log: (m) => logs.push(m),
      scan: async () => {
        scanCalled = true;
        return SAMPLE_SCAN;
      },
      loadConfig: async () => ({ mode: 'agent', projectState: 'greenfield' }),
      complete: async () => {
        throw new Error('should not be called in greenfield');
      },
    });
    expect(scanCalled).toBe(false);
    expect(logs.join('\n')).toContain('No code yet');
  });

  it('errors when the scan returns zero files', async () => {
    await expect(
      explainCommand(['login'], {
        cwd: dir,
        log: () => {},
        scan: async () => ({ ...SAMPLE_SCAN, files: [] }),
        loadConfig: async () => ({ mode: 'agent' }),
        complete: async () => '',
      }),
    ).rejects.toThrow(/No source files/);
  });
});
