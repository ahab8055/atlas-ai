import { loadConfig } from "@atlas-ai/config";
import {
  createAiRuntime,
  InferenceProviderRegistry,
  type AiRuntime,
  type ModelInfo,
  type RegisteredModel,
} from "@atlas-ai/ai";

import {
  openModelRegistrySession,
  type ModelRegistryCliOptions,
} from "./model-registry.js";

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
    inference: config.ai.inference,
    hardware: config.ai.hardware,
    llamaCpp: config.ai.llamaCpp,
  });
}

function printAiHelp(): void {
  process.stdout.write(
    [
      "Atlas AI runtime commands:",
      "  atlas ai status              Probe local inference provider health",
      "  atlas ai models              List registered / available models",
      "  atlas ai register            Scan models/ and persist registry entries",
      "  atlas ai load [modelId]      Validate/load GGUF (default from config)",
      '  atlas ai ask "<prompt>"      Load default model and generate a reply',
      "",
      "Config: ai.provider, ai.endpoint, ai.defaultModelId, ai.inference, ai.hardware, ai.llamaCpp",
      "Env: ATLAS_AI_PROVIDER, ATLAS_AI_ENDPOINT, ATLAS_AI_DEFAULT_MODEL,",
      "     ATLAS_AI_ACCELERATION, ATLAS_AI_GPU_LAYERS, ATLAS_AI_MANAGE_SERVER",
    ].join("\n") + "\n",
  );
}

/**
 * Handle `ai` / `ai status` / `ai models` / `ai register` / `ai load` / `ai ask`
 * without the request pipeline.
 * Returns true when the input was an AI runtime command.
 */
export async function tryHandleAiCommand(
  rawInput: string,
  options: ModelRegistryCliOptions = { enableDatabase: true },
): Promise<boolean> {
  const trimmed = rawInput.trim();

  if (/^ai\s*$/i.test(trimmed)) {
    printAiHelp();
    process.exitCode = 0;
    return true;
  }

  const statusMatch = /^ai\s+(status|health)\s*$/i.exec(trimmed);
  if (statusMatch) {
    await handleStatus();
    return true;
  }

  const modelsMatch = /^ai\s+models\s*$/i.exec(trimmed);
  if (modelsMatch) {
    await handleModels(options);
    return true;
  }

  const registerMatch = /^ai\s+(register|sync-models)\s*$/i.exec(trimmed);
  if (registerMatch) {
    handleRegister(options);
    return true;
  }

  const loadMatch = /^ai\s+load(?:\s+(\S+))?\s*$/i.exec(trimmed);
  if (loadMatch) {
    await handleLoad(loadMatch[1]);
    return true;
  }

  const askMatch = /^ai\s+ask\s+(.+)$/is.exec(trimmed);
  if (askMatch) {
    await handleAsk(askMatch[1]!.trim());
    return true;
  }

  if (/^ai\s+/i.test(trimmed)) {
    printAiHelp();
    process.exitCode = 2;
    return true;
  }

  return false;
}

async function handleStatus(): Promise<void> {
  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig();
  const health = await runtime.health();
  const active = runtime.getActiveModel();
  const hw = config.ai.hardware;
  const inf = config.ai.inference;

  const out = [
    `AI provider: ${health.provider}`,
    `Healthy: ${health.ok ? "yes" : "no"}`,
    `Message: ${health.message}`,
    ...(health.endpoint ? [`Endpoint: ${health.endpoint}`] : []),
    `Configured provider: ${config.ai.provider}`,
    `Default model: ${config.ai.defaultModelId}`,
    `Models dir: ${config.paths.modelsDir}`,
    `Acceleration: ${hw.acceleration} (gpuLayers=${hw.gpuLayers}, threads=${hw.threads}, ctx=${hw.contextSize})`,
    `Inference: temp=${inf.temperature} maxTokens=${inf.maxTokens} topP=${inf.topP} topK=${inf.topK} repeatPenalty=${inf.repeatPenalty}`,
    `Manage llama-server: ${config.ai.llamaCpp.manageServer ? "yes" : "no"} (${config.ai.llamaCpp.binary})`,
    `Available providers: ${runtime.listProviders().join(", ")}`,
    ...(active
      ? [`Active model: ${active.id}${active.path ? ` (${active.path})` : ""}`]
      : []),
    `Checked at: ${health.checkedAt}`,
  ];

  process.stdout.write(`${out.join("\n")}\n`);
  process.exitCode = health.ok ? 0 : 1;
}

function formatRegisteredModel(m: RegisteredModel): string {
  const size =
    m.sizeBytes !== undefined
      ? ` ${(m.sizeBytes / (1024 * 1024)).toFixed(1)}MiB`
      : "";
  const caps =
    m.capabilities.length > 0 ? ` caps=[${m.capabilities.join(",")}]` : "";
  const ctx = m.contextLength !== undefined ? ` ctx=${m.contextLength}` : "";
  const loc = m.location ? ` ${m.location}` : "";
  return `- ${m.id} v${m.version} [${m.format}/${m.status}]${size}${ctx}${caps}${loc}`;
}

async function handleModels(options: ModelRegistryCliOptions): Promise<void> {
  const session = openModelRegistrySession(options);
  try {
    // Keep registry up to date with on-disk installs, then query persistable metadata.
    session.registry.syncFromDisk();
    const registered = session.registry.list();

    if (registered.length > 0) {
      const source = session.database
        ? "registry (persistent)"
        : "registry (memory)";
      process.stdout.write(
        `Registered models (${source}):\n${registered.map(formatRegisteredModel).join("\n")}\n`,
      );
      process.exitCode = 0;
      return;
    }

    // Fall back to provider enumeration when nothing is registered yet.
    const runtime = createAiRuntimeFromConfig();
    const models = await runtime.listModels();
    if (models.length === 0) {
      process.stdout.write(
        "No models found. Place GGUF files under models/ then run: atlas ai register\n",
      );
      process.exitCode = 0;
      return;
    }
    const lines = models.map((m: ModelInfo) => {
      const size =
        m.sizeBytes !== undefined
          ? ` ${(m.sizeBytes / (1024 * 1024)).toFixed(1)}MiB`
          : "";
      return `- ${m.id} [${m.status}]${size}${m.path ? ` ${m.path}` : ""}`;
    });
    process.stdout.write(
      `Provider models (not yet registered):\n${lines.join("\n")}\n`,
    );
    process.exitCode = 0;
  } finally {
    session.close();
  }
}

function handleRegister(options: ModelRegistryCliOptions): void {
  const session = openModelRegistrySession(options);
  try {
    const count = session.registry.syncFromDisk();
    const listed = session.registry.list();
    const persist = session.database
      ? "SQLite"
      : "memory (use without --no-db to persist)";
    process.stdout.write(
      [
        `Registered ${count} model(s) from disk (${persist}).`,
        `Queryable entries: ${listed.length}`,
        ...listed.map(formatRegisteredModel),
      ].join("\n") + "\n",
    );
    process.exitCode = 0;
  } finally {
    session.close();
  }
}

async function handleLoad(modelId?: string): Promise<void> {
  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig();
  try {
    const loaded = await runtime.loadModel(modelId ?? config.ai.defaultModelId);
    process.stdout.write(
      [
        `Loaded model: ${loaded.id}`,
        `Format: ${loaded.format}`,
        `Status: ${loaded.status}`,
        ...(loaded.path ? [`Path: ${loaded.path}`] : []),
        `Provider: ${loaded.provider}`,
      ].join("\n") + "\n",
    );
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

async function handleAsk(promptRaw: string): Promise<void> {
  let prompt = promptRaw;
  if (
    (prompt.startsWith('"') && prompt.endsWith('"')) ||
    (prompt.startsWith("'") && prompt.endsWith("'"))
  ) {
    prompt = prompt.slice(1, -1);
  }
  if (!prompt) {
    process.stderr.write('Usage: atlas ai ask "<prompt>"\n');
    process.exitCode = 2;
    return;
  }

  const runtime = createAiRuntimeFromConfig();
  try {
    await runtime.loadModel();
    const result = await runtime.generate({
      messages: [{ role: "user", content: prompt }],
    });
    process.stdout.write(`${result.text}\n`);
    if (process.env.ATLAS_CLI_DEBUG === "1") {
      process.stderr.write(
        `[ai] provider=${result.provider} model=${result.modelId} ${result.durationMs}ms\n`,
      );
    }
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
