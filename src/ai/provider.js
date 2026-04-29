import { complete as claudeComplete } from './providers/claude.js';

const ADAPTERS = {
  claude: claudeComplete,
  openai: notImplemented('openai'),
  gemini: notImplemented('gemini'),
};

function notImplemented(name) {
  return () => {
    throw new Error(
      `The ${name} provider isn't wired up yet. Use Claude for now (set ai.provider: claude in .draftwise/config.yaml) or run draft inside a coding agent.`,
    );
  };
}

export async function complete({
  provider,
  apiKeyEnv,
  model,
  system,
  prompt,
  maxTokens,
  onToken,
}) {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`Unknown AI provider "${provider}".`);
  }
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `Environment variable ${apiKeyEnv} is not set. Export it before running this command.`,
    );
  }
  return adapter({ apiKey, model, system, prompt, maxTokens, onToken });
}
