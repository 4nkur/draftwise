import { writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { input, select } from '@inquirer/prompts';
import { scan as defaultScan } from '../core/scanner.js';
import { loadConfig as defaultLoadConfig } from '../utils/config.js';
import { complete as defaultComplete } from '../ai/provider.js';
import {
  PLAN_SYSTEM,
  SPEC_SYSTEM,
  buildPlanPrompt,
  parsePlanResponse,
  buildSpecPrompt,
  buildAgentInstruction,
} from '../ai/prompts/new.js';
import { slugify } from '../utils/slug.js';

const DEFAULT_PROMPTS = {
  askQuestion: ({ index, total, text, why }) =>
    input({
      message: `Q${index + 1}/${total} — ${text}\n  (why: ${why})\n  Your answer (or press enter to skip):`,
    }),
  decideOpportunity: ({ index, total, flow, suggestion, rationale }) =>
    select({
      message: `Opportunity ${index + 1}/${total} — adjacent change in "${flow}"\n  Suggestion: ${suggestion}\n  Why: ${rationale}\n  Decision:`,
      choices: [
        { name: 'Accept — include in this spec',     value: 'accepted' },
        { name: 'Decline — keep it out',             value: 'declined' },
        { name: 'Defer — note it but don\'t commit', value: 'deferred' },
      ],
      default: 'declined',
    }),
};

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function compactScan(result) {
  return {
    frameworks: result.frameworks,
    orms: result.orms,
    routes: result.routes,
    components: result.components.slice(0, 50),
    models: result.models,
    fileCount: result.files.length,
    sampleFiles: result.files.slice(0, 30),
  };
}

export default async function newCommand(args = [], deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? ((msg) => console.log(msg));
  const scan = deps.scan ?? defaultScan;
  const loadConfig = deps.loadConfig ?? defaultLoadConfig;
  const complete = deps.complete ?? defaultComplete;
  const prompts = { ...DEFAULT_PROMPTS, ...(deps.prompts ?? {}) };

  const idea = args.join(' ').trim();
  if (!idea) {
    throw new Error(
      'Missing idea. Usage: draftwise new "<your feature idea>"',
    );
  }

  const draftwiseDir = join(cwd, '.draftwise');
  if (!(await pathExists(draftwiseDir))) {
    throw new Error('.draftwise/ not found. Run `draftwise init` first.');
  }

  const config = await loadConfig(cwd);

  log(`Idea: "${idea}"`);
  log('Scanning repo...');
  const result = await scan(cwd);
  if (!result.files || result.files.length === 0) {
    throw new Error(
      `No source files found under ${cwd}. Run \`draftwise new\` from your repo root.`,
    );
  }
  const scanForPrompt = compactScan(result);

  if (config.mode === 'agent') {
    log('');
    log('Agent mode — handing scanner data + the conversation plan off to your coding agent.');
    log('');
    log('---');
    log(`IDEA: ${idea}`);
    log('');
    log('SCANNER OUTPUT');
    log('```json');
    log(JSON.stringify(scanForPrompt, null, 2));
    log('```');
    log('');
    log('PACKAGE METADATA');
    log('```json');
    log(JSON.stringify(result.packageMeta, null, 2));
    log('```');
    log('');
    log('INSTRUCTION');
    log(buildAgentInstruction(idea));
    return;
  }

  log(`API mode — calling ${config.provider} for the conversation plan...`);
  const planText = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    system: PLAN_SYSTEM,
    prompt: buildPlanPrompt({
      idea,
      scan: scanForPrompt,
      packageMeta: result.packageMeta,
    }),
  });

  const plan = parsePlanResponse(planText);
  log('');
  log(`Feature: ${plan.featureTitle} (slug: ${plan.featureSlug})`);
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
    log(`Pitching ${plan.adjacentOpportunities.length} adjacent opportunities:`);
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
  log(`Synthesizing product-spec.md (${config.provider})...`);
  const spec = await complete({
    provider: config.provider,
    apiKeyEnv: config.apiKeyEnv,
    model: config.model,
    system: SPEC_SYSTEM,
    prompt: buildSpecPrompt({
      idea,
      plan,
      scan: scanForPrompt,
      packageMeta: result.packageMeta,
      answers,
      opportunityDecisions,
    }),
  });

  const slug = slugify(plan.featureSlug);
  const specDir = join(draftwiseDir, 'specs', slug);
  await mkdir(specDir, { recursive: true });
  await writeFile(join(specDir, 'product-spec.md'), spec, 'utf8');

  log('');
  log(`Wrote .draftwise/specs/${slug}/product-spec.md`);
  log('Next: review, refine, then run `draftwise tech` to generate the technical spec.');
}
