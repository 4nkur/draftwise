import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { input, select } from '@inquirer/prompts';
import { cachedScan as defaultScan } from '../utils/scan-cache.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import { readOverview as defaultReadOverview } from '../utils/overview.js';
import { requireDraftwiseDir } from '../utils/draftwise-dir.js';
import { loadScanContext } from '../utils/scan-context.js';
import { confirmOverwriteOrCancel } from '../utils/overwrite-guard.js';
import { isInteractive as defaultIsInteractive } from '../utils/tty.js';
import { AGENT_HANDOFF_PREFIX } from '../utils/agent-handoff.js';
import { loadAnswersFlag } from '../utils/answers-flag.js';
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
  draftwise new "let users mute notifications" --force

Flags:
  --force, -f                  Skip the overwrite confirmation prompt.
  --answers <json|@file>       JSON array of answers to clarifying questions
                               (e.g. \`["public", "yes, async"]\`), or
                               @path/to/answers.json. Used in non-TTY shells
                               (CI, coding-agent wrappers) where inquirer can't
                               run; if absent and non-TTY, all questions are
                               treated as unanswered and adjacent opportunities
                               are declined.

Three phases:
  1. AI plans the conversation — clarifying questions tailored to
     your repo (or your greenfield plan), affected flows, and
     adjacent opportunities.
  2. You walk through questions and accept/decline opportunities.
  3. AI synthesizes a product-spec.md under .draftwise/specs/<slug>/.

If product-spec.md already exists for the resolved slug (a re-run
on the same idea, for instance), you'll be asked to confirm before
it's overwritten — pass --force to skip the prompt. In non-TTY
without --force, the command errors instead of overwriting.

Hard rule: every claim grounds in scanner output (brownfield) or
the project plan (greenfield). Never invents files.
`;

const ARG_OPTIONS = {
  force: { type: 'boolean', short: 'f' },
  answers: { type: 'string' },
};

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
};

export default async function newCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.error(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;
  const readOverview = deps.readOverview ?? defaultReadOverview;
  const isInteractive = deps.isInteractive ?? defaultIsInteractive;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: ARG_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    throw new Error(`Invalid arguments to draftwise new: ${err.message}`, {
      cause: err,
    });
  }
  const force = Boolean(parsed.values.force);
  const answersFlag = await loadAnswersFlag(parsed.values.answers);
  const idea = parsed.positionals.join(' ').trim();
  if (!idea) {
    throw new Error('Missing idea. Usage: draftwise new "<your feature idea>"');
  }

  const draftwiseDir = await requireDraftwiseDir(cwd);

  const config = await loadConfig(cwd);
  const isGreenfield = config.projectState === 'greenfield';

  log(`Idea: "${idea}"`);

  const { scanForPrompt, packageMeta, overview } = await loadScanContext({
    cwd,
    config,
    log,
    scan,
    readOverview,
    commandName: 'new',
  });

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
    log(AGENT_HANDOFF_PREFIX);
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

  // Confirm before clobbering an existing product-spec.md. Done before the Q&A
  // loop so a cancel doesn't waste the user's time on questions whose answers
  // get thrown away.
  const slug = slugify(plan.featureSlug);
  const specDir = join(draftwiseDir, 'specs', slug);
  const productSpecPath = join(specDir, 'product-spec.md');
  const proceed = await confirmOverwriteOrCancel({
    targetPath: productSpecPath,
    slug,
    file: 'product-spec.md',
    force,
    isInteractive,
    log,
    confirmOverwrite: prompts.confirmOverwrite,
  });
  if (!proceed) return;

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

  let answers;
  if (answersFlag) {
    answers = answersFlag.slice(0, plan.clarifyingQuestions.length);
    while (answers.length < plan.clarifyingQuestions.length) answers.push('');
  } else if (isInteractive()) {
    answers = [];
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
  } else {
    // Non-TTY without --answers: model gets no answers. The spec will lean on
    // the AI's best guess. Pass --answers next time for a richer draft.
    answers = plan.clarifyingQuestions.map(() => '');
    log('(non-interactive: no --answers supplied — questions left blank.)');
  }

  let opportunityDecisions;
  if (plan.adjacentOpportunities.length > 0) {
    if (isInteractive()) {
      log('');
      log(
        `Pitching ${plan.adjacentOpportunities.length} adjacent opportunities:`,
      );
      log('');
      opportunityDecisions = [];
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
    } else {
      // Non-TTY: decline all. The spec stays focused on the original idea.
      opportunityDecisions = plan.adjacentOpportunities.map(() => 'declined');
    }
  } else {
    opportunityDecisions = [];
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
