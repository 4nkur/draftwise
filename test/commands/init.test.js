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
        prompts: { promptIdea: async () => 'unused' },
        isInteractive: interactiveTrue,
        scan: fakeScan(['src/foo.js']),
      }),
    ).rejects.toThrow(/already exists/);
  });

  describe('brownfield path', () => {
    it('writes the .draftwise/ skeleton with project.state and no ai block', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
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
      expect(config).toContain('state: brownfield');
      expect(config).not.toContain('ai:');
      expect(config).not.toContain('provider:');
      expect(config).not.toContain('mode:');

      const gitignore = await readFile(join(drafts, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.cache/');
    });

    it('errors when --mode=brownfield is forced but the repo has no source files', async () => {
      await expect(
        init(['--mode=brownfield'], {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveTrue,
          scan: fakeScan([]),
        }),
      ).rejects.toThrow(/No source files/);
    });
  });

  describe('greenfield path', () => {
    it('prints the conversation instruction and writes a placeholder', async () => {
      const logs = [];
      await init(['--mode=greenfield', '--idea=a recipe sharing app for home cooks'], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveTrue,
        scan: fakeScan([]),
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
      expect(config).toContain('state: greenfield');
      expect(config).not.toContain('ai:');
      expect(config).not.toContain('stack:');
    });

    it('prompts for --idea when interactive and not supplied', async () => {
      let promptCalls = 0;
      await init(['--mode=greenfield'], {
        cwd: dir,
        log: () => {},
        isInteractive: interactiveTrue,
        prompts: {
          promptIdea: async () => {
            promptCalls++;
            return 'a brand new idea';
          },
        },
        scan: fakeScan([]),
      });

      expect(promptCalls).toBe(1);
      const overview = await readFile(
        join(dir, '.draftwise', 'overview.md'),
        'utf8',
      );
      expect(overview).toContain('a brand new idea');
    });

    it('does NOT require source files (empty repo is fine)', async () => {
      await init(['--mode=greenfield', '--idea=a brand new idea'], {
        cwd: dir,
        log: () => {},
        isInteractive: interactiveTrue,
        scan: fakeScan([]),
      });

      await access(join(dir, '.draftwise', 'overview.md'));
    });
  });

  describe('non-TTY (flags-driven)', () => {
    function noPrompts() {
      const fail = () => {
        throw new Error('inquirer prompt fired in non-TTY test');
      };
      return { promptIdea: fail };
    }

    it('brownfield runs end-to-end with no flags (no questions to ask)', async () => {
      await init([], {
        cwd: dir,
        log: () => {},
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        detectProjectState: detectBrownfield,
        scan: fakeScan(['src/foo.js']),
      });

      const config = await readFile(
        join(dir, '.draftwise', 'config.yaml'),
        'utf8',
      );
      expect(config).toContain('state: brownfield');
    });

    it('greenfield + --idea writes the placeholder plan', async () => {
      await init(['--mode=greenfield', '--idea=A new idea'], {
        cwd: dir,
        log: () => {},
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan([]),
      });

      const overview = await readFile(
        join(dir, '.draftwise', 'overview.md'),
        'utf8',
      );
      expect(overview).toContain('A new idea');
    });

    it('prints the structured handoff when greenfield + non-TTY + no --idea', async () => {
      const logs = [];
      await init([], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveFalse,
        prompts: noPrompts(),
        scan: fakeScan([]),
      });

      const out = logs.join('\n');
      expect(out).toContain('coding agent should pick this up');
      expect(out).toContain('INIT — answer');
      expect(out).toContain('Detected: new project');
      expect(out).toContain('What do you want to build');
      expect(out).toContain('INSTRUCTION');
      expect(out).toContain('draftwise init --mode=greenfield --idea=');

      // No files written — init bailed before writing.
      await expect(
        readFile(join(dir, '.draftwise', 'config.yaml'), 'utf8'),
      ).rejects.toThrow();
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
        init(['--mode=halffield'], {
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
        init(['--mode=brownfield', '--bogus=yes'], {
          cwd: dir,
          log: () => {},
          isInteractive: interactiveFalse,
          prompts: noPrompts(),
          scan: fakeScan(['src/foo.js']),
        }),
      ).rejects.toThrow(/Invalid arguments to draftwise init/);
    });
  });

  describe('auto-detect project state', () => {
    it('auto-detects brownfield from on-disk source files when --mode is omitted', async () => {
      await writeFile(join(dir, 'index.ts'), 'export {};', 'utf8');

      const logs = [];
      await init([], {
        cwd: dir,
        log: (m) => logs.push(m),
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
      const logs = [];
      await init(['--idea=a thing'], {
        cwd: dir,
        log: (m) => logs.push(m),
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
      await writeFile(join(dir, 'app.py'), 'print(1)', 'utf8');

      const logs = [];
      await init(['--mode=greenfield', '--idea=a thing'], {
        cwd: dir,
        log: (m) => logs.push(m),
        isInteractive: interactiveTrue,
        scan: fakeScan(['app.py']),
      });

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
