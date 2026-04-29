import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const VERSION = pkg.version;

const COMMANDS = {
  init: () => import('./commands/init.js'),
  scan: () => import('./commands/scan.js'),
  explain: () => import('./commands/explain.js'),
  new: () => import('./commands/new.js'),
  tech: () => import('./commands/tech.js'),
  tasks: () => import('./commands/tasks.js'),
  list: () => import('./commands/list.js'),
  show: () => import('./commands/show.js'),
  scaffold: () => import('./commands/scaffold.js'),
};

// Grouped subcommands. `draftwise skills <sub>` follows the same pattern as
// `git remote <sub>` / `gh pr <sub>`. Helps keep the top-level help focused on
// domain verbs (init, new, tech, tasks…) instead of mixing in infrastructure.
const SUBCOMMAND_GROUPS = {
  skills: {
    install: () => import('./commands/skills/install.js'),
    uninstall: () => import('./commands/skills/uninstall.js'),
    help: () => import('./commands/skills/help.js'),
  },
};

const HELP = `draftwise — codebase-aware spec drafting

Usage:
  draftwise <command> [args]

Commands:
  init                          Set up .draftwise/ — greenfield plan or brownfield scan
  scaffold                      Create initial files from a greenfield plan (greenfield only)
  scan                          Refresh the codebase overview
  explain <flow>                Trace how a specific flow works in the code
  new "<idea>"                  Conversational drafting → product-spec.md
  tech [<feature>]              Draft technical-spec.md from approved product spec
  tasks [<feature>]             Generate ordered tasks.md from technical spec
  list                          List all specs in .draftwise/specs/
  show <feature> [type]         Show a spec (type: product | tech | tasks; default: product)
  skills <install|uninstall|help>   Manage the standalone slash-command skill across harnesses
                                    (Claude Code, Cursor, Gemini CLI). Bare /draftwise <verb>
                                    in chat. Run \`draftwise skills help\` for the full surface.

Flags:
  -h, --help                    Show this help (or per-command help when after a command)
  -v, --version                 Print the installed draftwise version

Each command takes its own flags — run \`draftwise <command> --help\`
for details. All commands work non-interactively when given the
flags they need; in a real TTY, missing values fall back to inquirer
prompts. See per-command --help for the flag list.

Set DRAFTWISE_DEBUG=1 for stack traces on unexpected errors.
`;

function asksForHelp(args) {
  return args.includes('--help') || args.includes('-h');
}

// Picks the right subcommand loader for a grouped command (e.g. `skills`).
// Falls back to the group's own `help` loader when no subcommand was given
// or when --help was passed at the group level (`draftwise skills --help`).
function resolveSubcommandLoader(groupName, group, rest) {
  const sub = rest[0];
  if (!sub || sub === '--help' || sub === '-h' || sub === 'help') {
    return group.help ?? null;
  }
  const loader = group[sub];
  if (!loader) {
    const known = Object.keys(group).join(', ');
    console.error(
      `Unknown ${groupName} subcommand: ${sub}\nKnown: ${known}\n`,
    );
    process.exit(1);
  }
  return loader;
}

export default async function run(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(HELP);
    return;
  }

  if (cmd === '-v' || cmd === '--version' || cmd === 'version') {
    console.log(VERSION);
    return;
  }

  const subcommandGroup = SUBCOMMAND_GROUPS[cmd];
  const loader = subcommandGroup
    ? resolveSubcommandLoader(cmd, subcommandGroup, rest)
    : COMMANDS[cmd];
  if (!loader) {
    console.error(`Unknown command: ${cmd}\n`);
    console.error(HELP);
    process.exit(1);
  }
  // For grouped subcommands, the first arg in `rest` was the subcommand name —
  // strip it before passing the remainder to the loaded module.
  const argsForCmd = subcommandGroup ? rest.slice(1) : rest;

  try {
    const mod = await loader();
    if (asksForHelp(argsForCmd)) {
      console.log(mod.HELP || `(no help available for "${cmd}")`);
      return;
    }
    await mod.default(argsForCmd);
  } catch (err) {
    if (process.env.DRAFTWISE_DEBUG === '1') {
      console.error(err?.stack || err);
      if (err?.cause) {
        console.error('Caused by:');
        console.error(err.cause?.stack || err.cause);
      }
    } else {
      console.error(err?.message ?? err);
      console.error('  (set DRAFTWISE_DEBUG=1 to see the stack trace)');
    }
    process.exit(1);
  }
}
