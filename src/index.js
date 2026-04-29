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

  const loader = COMMANDS[cmd];
  if (!loader) {
    console.error(`Unknown command: ${cmd}\n`);
    console.error(HELP);
    process.exit(1);
  }

  try {
    const mod = await loader();
    if (asksForHelp(rest)) {
      console.log(mod.HELP || `(no help available for "${cmd}")`);
      return;
    }
    await mod.default(rest);
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
