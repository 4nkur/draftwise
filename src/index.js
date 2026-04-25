const COMMANDS = {
  init: () => import('./commands/init.js'),
  scan: () => import('./commands/scan.js'),
  explain: () => import('./commands/explain.js'),
  new: () => import('./commands/new.js'),
};

const HELP = `draftwise — codebase-aware spec drafting

Usage:
  draftwise <command> [args]

Commands:
  init                  Scan codebase and set up .draftwise/
  scan                  Refresh the codebase overview
  explain <flow>        Trace how a specific flow works in the code
  new "<idea>"          Conversational drafting → product-spec.md

Run "draftwise <command> --help" for command-specific help (coming soon).
`;

export default async function run(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    console.log(HELP);
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
    await mod.default(rest);
  } catch (err) {
    console.error(err?.message ?? err);
    process.exit(1);
  }
}
