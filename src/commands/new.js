import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { input, select, confirm } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { describeScanWarnings } from '../utils/scan-warnings.js';
import { pathExists } from '../utils/fs.js';
import { compactScan } from '../utils/scan-projection.js';
import {
  selectPlanSystem,
  selectSpecSystem,
  buildPlanPrompt,
  parsePlanResponse,
  buildSpecPrompt,
  buildAgentInstruction,
} from '../ai/prompts/new.js';
import { slugify } from '../utils/slug.js';

export const HELP = `draftwise new "<idea>" [--force] — conversational product-spec drafting

Usage:
  draftwise new "<your feature idea>"
  draftwise new "add collaborative albums"
  draftwise new "let users mute notifications"

Flags:
  --force                       # skip the overwrite confirmation prompt

Three phases:
  1. AI plans the conversation — clarifying questions tailored to
     your repo (or your greenfield plan), affected flows, and
     adjacent opportunities.
  2. You walk through questions and accept/decline opportunities.
  3. AI synthesizes a product-spec.md under .draftwise/specs/<slug>/.

If product-spec.md already exists for the resolved slug (a re-run
on the same idea, for instance), you'll be asked to confirm before
it's overwritten — pass --force to skip the prompt. Hard rule:
every claim grounds in scanner output (brownfield) or the project
plan (greenfield). Never invents files.
`;

const DEFAULT_PROMPTS = {
  askQuestion: ({ index, total, text, why }) =>
    input({
      message: `Q${index + 1}/${total} — ${text}\n  Why: ${why}\n  (press enter to skip)`,
    }),
  decideOpportunity: ({ index, total, flow, suggestion, rationale }) =>
    select({
      message: `Opportunity ${index + 1}/${total} — adjacent change in "${flow}"\n  Suggestion: ${suggestion}\n  Why: ${rationale}`,
      choices: [
        { name: 'Accept — include in this spec', value: 'accepted' },
        { name: 'Decline — keep it out', value: 'declined' },
        { name: "Defer — note it but don't commit", value: 'deferred' },
      ],
      default: 'declined',
    }),
  confirmOverwrite: ({ slug, file }) =>
    confirm({
      message: `${slug}/${file} already exists. Overwrite?`,
      default: false,
    }),
};

export default async function newCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;
  const readOverview = deps.readOverview ?? defaultReadOverview;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  const force = args.includes('--force') || args.includes('-f');
  const positional = args.filter((a) => a !== '--force' && a !== '-f');
  const idea = positional.join(' ').trim();
  if (!idea) {
    throw new Error('Missing idea. Usage: draftwise new "<your feature idea>"');
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }

  const config = await loadConfig(cwd);
  const isGreenfield = config.projectState === 'greenfield';

  log(`Idea: "${idea}"`);

  let scanForPrompt;
  let packageMeta;
  let overview;

  if (isGreenfield) {
    log('Reading project plan from overview.md...');
    overview = await readOverview(cwd);
    if (!overview.trim()) {
      throw new Error(
        'Greenfield project but .draftwise/overview.md is missing or empty. Re-run `draftwise init` to generate the plan, or switch the config to brownfield once code exists.',
      );
    }
    scanForPrompt = null;
    packageMeta = null;
  } else {
    log('Scanning repo...');
    const result = await scan(cwd, { maxFiles: config.scanMaxFiles });
    if (!result.files || result.files.length === 0) {
      throw new Error(
        `No source files found under ${cwd}. Run \`draftwise new\` from your repo root.`,
      );
    }
    for (const warning of describeScanWarnings(result)) {
      log(warning);
    }
    scanForPrompt = compactScan(result);
    packageMeta = result.packageMeta;
  }

  if (config.mode === 'agent') {
    log('');
    if (isGreenfield) {
      log(
        'Agent mode — handing the project plan + conversation off to your coding agent.',
      );
    } else {
      log(
        'Agent mode — handing scanner data + the conversation plan off to your coding agent.',
      );
    }
    log('');
    log('---');
    log(`IDEA: ${idea}`);
    log('');
    if (isGreenfield) {
      log('PROJECT PLAN (overview.md)');
      log(overview);
    } else {
      log('SCANNER OUTPUT');
      log('```json');
      log(JSON.stringify(scanForPrompt, null, 2));
      log('```');
      log('');
      log('PACKAGE METADATA');
      log('```json');
      log(JSON.stringify(packageMeta, null, 2));
      log('```');
    }
    log('');
    log('INSTRUCTION');
    log(buildAgentInstruction(idea, config.projectState));
    return;
  }

  log(`API mode — calling ${config.provider} for the conversation plan...`);
  const planText = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    maxTokens: config.maxTokens,
    system: selectPlanSystem(config.projectState),
    prompt: buildPlanPrompt({
      idea,
      scan: scanForPrompt,
      packageMeta,
      projectState: config.projectState,
      overview,
    }),
  });

  const plan = parsePlanResponse(planText);
  log('');
  log(`Feature: ${plan.featureTitle} (slug: ${plan.featureSlug})`);

  // Confirm before clobbering an existing product-spec.md (re-running on the
  // same idea, slug collision, etc.). Done before the Q&A loop so a cancel
  // doesn't waste the user's time on questions whose answers get thrown away.
  const slug = slugify(plan.featureSlug);
  const specDir = join(draftwiseDir, 'specs', slug);
  const productSpecPath = join(specDir, 'product-spec.md');
  if (!force && (await pathExists(productSpecPath))) {
    log('');
    const proceed = await prompts.confirmOverwrite({
      slug,
      file: 'product-spec.md',
    });
    if (!proceed) {
      log(
        'Cancelled. No changes written. (Pass --force to skip this prompt.)',
      );
      return;
    }
  }

  if (plan.affectedFlows.length > 0) {
    log('');
    log('Affected flows:');
    for (const f of plan.affectedFlows) {
      log(`  • ${f.name} — ${f.impact}`);
      for (const file of f.files ?? []) log(`      ${file}`);
    }
  }
  log('');
  log(`Walking through ${plan.clarifyingQuestions.length} clarifying questions:`);
  log('');

  const answers = [];
  for (let i = 0; i < plan.clarifyingQuestions.length; i++) {
    const q = plan.clarifyingQuestions[i];
    const answer = await prompts.askQuestion({
      index: i,
      total: plan.clarifyingQuestions.length,
      text: q.text,
      why: q.why,
    });
    answers.push(answer);
  }

  const opportunityDecisions = [];
  if (plan.adjacentOpportunities.length > 0) {
    log('');
    log(
      `Pitching ${plan.adjacentOpportunities.length} adjacent opportunities:`,
    );
    log('');
    for (let i = 0; i < plan.adjacentOpportunities.length; i++) {
      const o = plan.adjacentOpportunities[i];
      const decision = await prompts.decideOpportunity({
        index: i,
        total: plan.adjacentOpportunities.length,
        flow: o.flow,
        suggestion: o.suggestion,
        rationale: o.rationale,
      });
      opportunityDecisions.push(decision);
    }
  }

  log('');
  log(`Drafting product-spec.md (${config.provider})...`);
  log('');
  const spec = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    maxTokens: config.maxTokens,
    system: selectSpecSystem(config.projectState),
    prompt: buildSpecPrompt({
      idea,
      plan,
      scan: scanForPrompt,
      packageMeta,
      answers,
      opportunityDecisions,
      projectState: config.projectState,
      overview,
    }),
    onToken: (chunk) => process.stdout.write(chunk),
  });
  log('');

  await mkdir(specDir, { recursive: true });
  await writeFile(productSpecPath, spec, 'utf8');

  log('');
  log(`Wrote .draftwise/specs/${slug}/product-spec.md`);
  log(
    'Next: review, refine, then run `draftwise tech` to generate the technical spec.',
  );
}
