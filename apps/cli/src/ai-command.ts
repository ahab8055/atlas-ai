import { loadConfig } from "@atlas-ai/config";
import {
  createAiRuntime,
  InferenceProviderRegistry,
  type AiRuntime,
} from "@atlas-ai/ai";

/**
 * Build an AiRuntime from Atlas config (+ env overrides via loadConfig).
 */
export function createAiRuntimeFromConfig(repoRoot?: string): AiRuntime {
  const config = loadConfig(repoRoot ? { repoRoot } : {});
  return createAiRuntime({
    registry: new InferenceProviderRegistry(),
    provider: config.ai.provider,
    endpoint: config.ai.endpoint,
    defaultModelId: config.ai.defaultModelId,
    modelsDir: config.paths.modelsDir,
  });
}

/**
 * Handle `ai` / `ai status` / `ai health` without the request pipeline.
 * Returns true when the input was an AI runtime command.
 */
export async function tryHandleAiCommand(rawInput: string): Promise<boolean> {
  const trimmed = rawInput.trim();

  if (/^ai\s*$/i.test(trimmed)) {
    process.stdout.write(
      [
        "Atlas AI runtime commands:",
        "  atlas ai status   Probe local inference provider health",
        "",
        "Config: ai.provider, ai.endpoint, ai.defaultModelId",
        "Env: ATLAS_AI_PROVIDER, ATLAS_AI_ENDPOINT, ATLAS_AI_DEFAULT_MODEL",
      ].join("\n") + "\n",
    );
    process.exitCode = 0;
    return true;
  }

  const match = /^(ai)\s+(status|health)\s*$/i.exec(trimmed);
  if (!match) {
    return false;
  }

  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig();
  const health = await runtime.health();
  const active = runtime.getActiveModel();

  const out = [
    `AI provider: ${health.provider}`,
    `Healthy: ${health.ok ? "yes" : "no"}`,
    `Message: ${health.message}`,
    ...(health.endpoint ? [`Endpoint: ${health.endpoint}`] : []),
    `Configured provider: ${config.ai.provider}`,
    `Default model: ${config.ai.defaultModelId}`,
    `Models dir: ${config.paths.modelsDir}`,
    `Available providers: ${runtime.listProviders().join(", ")}`,
    ...(active ? [`Active model: ${active.id}`] : []),
    `Checked at: ${health.checkedAt}`,
  ];

  process.stdout.write(`${out.join("\n")}\n`);
  process.exitCode = health.ok ? 0 : 1;
  return true;
}
