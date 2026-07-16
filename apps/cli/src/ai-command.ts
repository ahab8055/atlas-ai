import { loadConfig } from "@atlas-ai/config";
import {
  createAiRuntime,
  createModelInstaller,
  createModelStorageManager,
  detectHardware,
  evaluateModelSuitability,
  listResourceProfiles,
  recommendModelsForProfile,
  InferenceProviderRegistry,
  type AiRuntime,
  type ModelCategory,
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function printAiHelp(): void {
  process.stdout.write(
    [
      "Atlas AI runtime commands:",
      "  atlas ai status              Probe local inference provider health",
      "  atlas ai models              List registered / available models",
      "  atlas ai register            Scan models/ and persist registry entries",
      "  atlas ai storage             Ensure layout + show storage usage",
      "  atlas ai validate            Validate stored model files",
      "  atlas ai remove <modelId>    Delete a model file (+ unregister)",
      "  atlas ai hardware           Detect CPU/RAM/GPU/OS + active profile",
      "  atlas ai profiles           List low/balanced/performance profiles",
      "  atlas ai recommend          Recommend models for this machine",
      "  atlas ai install <src> [cat] Install GGUF (file/URL) + register",
      "  atlas ai install --dry-run … Compatibility/storage check only",
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
 * Handle `ai` … commands without the request pipeline.
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

  const storageMatch = /^ai\s+storage\s*$/i.exec(trimmed);
  if (storageMatch) {
    handleStorage();
    return true;
  }

  const validateMatch = /^ai\s+validate(?:-models)?\s*$/i.exec(trimmed);
  if (validateMatch) {
    handleValidate();
    return true;
  }

  const removeMatch = /^ai\s+remove\s+(\S+)\s*$/i.exec(trimmed);
  if (removeMatch) {
    handleRemove(removeMatch[1]!, options);
    return true;
  }

  const hardwareMatch = /^ai\s+hardware\s*$/i.exec(trimmed);
  if (hardwareMatch) {
    handleHardware(options);
    return true;
  }

  const profilesMatch = /^ai\s+profiles\s*$/i.exec(trimmed);
  if (profilesMatch) {
    handleProfiles();
    return true;
  }

  const recommendMatch = /^ai\s+recommend\s*$/i.exec(trimmed);
  if (recommendMatch) {
    handleRecommend(options);
    return true;
  }

  const installMatch =
    /^ai\s+install(?:\s+(--dry-run|--check))?\s+(\S+)(?:\s+(\S+))?\s*$/i.exec(
      trimmed,
    );
  if (installMatch) {
    await handleInstall(
      installMatch[2]!,
      installMatch[3],
      Boolean(installMatch[1]),
      options,
    );
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

function formatRegisteredModel(
  m: RegisteredModel,
  suitability?: { suitable: boolean; reasons: string[] },
): string {
  const size =
    m.sizeBytes !== undefined
      ? ` ${(m.sizeBytes / (1024 * 1024)).toFixed(1)}MiB`
      : "";
  const caps =
    m.capabilities.length > 0 ? ` caps=[${m.capabilities.join(",")}]` : "";
  const ctx = m.contextLength !== undefined ? ` ctx=${m.contextLength}` : "";
  const loc = m.location ? ` ${m.location}` : "";
  const fit =
    suitability === undefined
      ? ""
      : suitability.suitable
        ? " fit=yes"
        : ` fit=no (${suitability.reasons.join("; ")})`;
  return `- ${m.id} v${m.version} [${m.format}/${m.status}]${size}${ctx}${caps}${fit}${loc}`;
}

async function handleModels(options: ModelRegistryCliOptions): Promise<void> {
  const session = openModelRegistrySession(options);
  try {
    session.registry.syncFromDisk();
    const registered = session.registry.list();

    if (registered.length > 0) {
      const hardware = detectHardware({ skipGpuProbe: false });
      const source = session.database
        ? "registry (persistent)"
        : "registry (memory)";
      const lines = registered.map((model) =>
        formatRegisteredModel(
          model,
          evaluateModelSuitability(model.requirements, hardware),
        ),
      );
      process.stdout.write(
        `Registered models (${source}, profile=${hardware.profileId}):\n${lines.join("\n")}\n`,
      );
      process.exitCode = 0;
      return;
    }

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
        ...listed.map((model) => formatRegisteredModel(model)),
      ].join("\n") + "\n",
    );
    process.exitCode = 0;
  } finally {
    session.close();
  }
}

function handleStorage(): void {
  const config = loadConfig();
  const storage = createModelStorageManager({
    modelsDir: config.paths.modelsDir,
  });
  const structure = storage.ensureStructure();
  const usage = storage.getUsage();

  const lines = [
    `Models directory: ${usage.modelsDir}`,
    `Structure ready: ${usage.structureReady ? "yes" : "no"}`,
    ...(structure.created.length > 0
      ? [`Created: ${structure.created.join(", ")}`]
      : []),
    `Files: ${usage.fileCount} (valid=${usage.validCount}, invalid=${usage.invalidCount})`,
    `Total size: ${formatBytes(usage.totalBytes)}`,
    "By slot:",
    ...(usage.bySlot.length === 0
      ? ["  (empty — place .gguf under models/ or models/<category>/)"]
      : usage.bySlot.map(
          (slot) =>
            `  ${slot.slot}: ${slot.fileCount} file(s), ${formatBytes(slot.totalBytes)} (valid=${slot.validCount}, invalid=${slot.invalidCount})`,
        )),
    "Layout: models/{general,coding,embeddings,speech}/ (+ root legacy)",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exitCode = 0;
}

function handleValidate(): void {
  const config = loadConfig();
  const storage = createModelStorageManager({
    modelsDir: config.paths.modelsDir,
  });
  storage.ensureStructure();
  const models = storage.validateAll();

  if (models.length === 0) {
    process.stdout.write(
      "No model files found under models/. Place GGUF weights then re-run.\n",
    );
    process.exitCode = 0;
    return;
  }

  const lines = models.map((m) => {
    const status = m.validation.ok ? "ok" : `INVALID (${m.validation.reason})`;
    return `- ${m.id} [${m.slot}] ${formatBytes(m.sizeBytes)} ${status}\n  ${m.path}`;
  });
  const invalid = models.filter((m) => !m.validation.ok).length;
  process.stdout.write(
    `Validated ${models.length} model(s); invalid=${invalid}\n${lines.join("\n")}\n`,
  );
  process.exitCode = invalid > 0 ? 1 : 0;
}

function handleRemove(modelId: string, options: ModelRegistryCliOptions): void {
  const config = loadConfig();
  const storage = createModelStorageManager({
    modelsDir: config.paths.modelsDir,
  });
  const result = storage.remove(modelId);

  const session = openModelRegistrySession(options);
  try {
    if (result.removed) {
      session.registry.remove(result.id);
      const base = result.id.includes("/")
        ? result.id.slice(result.id.lastIndexOf("/") + 1)
        : result.id;
      if (base !== result.id) {
        session.registry.remove(base);
      }
    }
  } finally {
    session.close();
  }

  if (result.removed) {
    process.stdout.write(
      `Removed model ${result.id}${result.path ? ` (${result.path})` : ""}\n`,
    );
    process.exitCode = 0;
    return;
  }

  process.stderr.write(
    `Could not remove ${modelId}: ${result.reason ?? "unknown error"}\n`,
  );
  process.exitCode = 1;
}

function handleHardware(options: ModelRegistryCliOptions): void {
  const config = loadConfig();
  const detected = detectHardware({
    contextSize: config.ai.hardware.contextSize,
  });

  const gpuLines =
    detected.gpus.length === 0
      ? ["  (none detected)"]
      : detected.gpus.map((gpu) => {
          const vram = gpu.vramGb !== undefined ? `, VRAM ${gpu.vramGb}GB` : "";
          const kind = gpu.integrated ? "integrated" : "dedicated";
          return `  - ${gpu.name} (${kind}${vram})`;
        });

  const session = openModelRegistrySession(options);
  let recommendLines: string[] = [];
  try {
    session.registry.syncFromDisk();
    const recs = recommendModelsForProfile(session.registry.list(), {
      hardware: detected,
      limit: 5,
    });
    recommendLines =
      recs.length === 0
        ? ["  (no registered models — run atlas ai register)"]
        : recs.map(
            (r) =>
              `  ${r.score}\t${r.model.id}${r.sizeClass ? ` [${r.sizeClass}]` : ""} — ${r.reasons[0] ?? ""}`,
          );
  } finally {
    session.close();
  }

  const lines = [
    `Detected at: ${detected.detectedAt}`,
    `OS: ${detected.os.type} ${detected.os.release} (${detected.os.platform}/${detected.os.arch})`,
    ...(detected.os.version ? [`OS version: ${detected.os.version}`] : []),
    `CPU: ${detected.cpu.model}`,
    `CPU cores/threads: ${detected.cpu.logicalProcessors}${detected.cpu.speedMhz ? ` @ ~${detected.cpu.speedMhz}MHz` : ""}`,
    `RAM: ${detected.memory.totalGb}GB total (${detected.memory.freeGb}GB free)`,
    `GPU available: ${detected.gpuAvailable ? "yes" : "no"}`,
    "GPUs:",
    ...gpuLines,
    `Hardware profile: ${detected.profile.label} (${detected.profileId})`,
    `Architecture name: ${detected.profile.architectureName}`,
    `Model guidance: size=${detected.profile.modelGuidance.sizeClass}, maxMinRam=${detected.profile.modelGuidance.maxMinRamGb}GB`,
    `Suggested inference: acceleration=${detected.inferenceProfile.acceleration} threads=${detected.inferenceProfile.threads ?? 0} gpuLayers=${detected.inferenceProfile.gpuLayers} contextSize=${detected.inferenceProfile.contextSize}`,
    `Configured inference: acceleration=${config.ai.hardware.acceleration} threads=${config.ai.hardware.threads} gpuLayers=${config.ai.hardware.gpuLayers} contextSize=${config.ai.hardware.contextSize}`,
    "Recommended models:",
    ...recommendLines,
    ...detected.notes.map((note) => `Note: ${note}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exitCode = 0;
}

function handleProfiles(): void {
  const lines = ["Hardware profiles (Architecture/25):"];
  for (const profile of listResourceProfiles()) {
    lines.push(
      `- ${profile.id} — ${profile.label} (${profile.architectureName})`,
      `  ${profile.description}`,
      `  categories: memory≥${profile.categories.memory.minRamGb}GB, gpu.required=${profile.categories.gpu.required}, accel=${profile.categories.acceleration.preferred}`,
      `  recommends: ${profile.modelGuidance.sizeClass} models (maxMinRam ${profile.modelGuidance.maxMinRamGb}GB)`,
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exitCode = 0;
}

function handleRecommend(options: ModelRegistryCliOptions): void {
  const detected = detectHardware();
  const session = openModelRegistrySession(options);
  try {
    session.registry.syncFromDisk();
    const models = session.registry.list();
    const recs = recommendModelsForProfile(models, {
      hardware: detected,
      limit: 10,
    });
    if (recs.length === 0) {
      process.stdout.write(
        `No recommendations for profile ${detected.profileId}. Register models with: atlas ai register\n`,
      );
      process.exitCode = 0;
      return;
    }
    const lines = [
      `Profile: ${detected.profile.label} (${detected.profileId})`,
      `Recommendations (${recs.length}):`,
      ...recs.map((r) => {
        const size =
          r.model.sizeBytes !== undefined
            ? ` ${(r.model.sizeBytes / (1024 * 1024)).toFixed(1)}MiB`
            : "";
        return `- [${r.score}] ${r.model.id}${size}${r.sizeClass ? ` class=${r.sizeClass}` : ""}\n  ${r.reasons.join("; ")}`;
      }),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    process.exitCode = 0;
  } finally {
    session.close();
  }
}

async function handleInstall(
  source: string,
  categoryRaw: string | undefined,
  dryRun: boolean,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const config = loadConfig();
  const category = (categoryRaw ?? "general") as ModelCategory;
  const session = openModelRegistrySession(options);
  try {
    const installer = createModelInstaller({
      modelsDir: config.paths.modelsDir,
      registry: session.registry,
      defaultProvider:
        config.ai.provider === "mock" ? "llamacpp" : config.ai.provider,
      defaultContextLength: config.ai.hardware.contextSize,
    });

    const result = await installer.install({
      source,
      category,
      dryRun,
      proceedOnWarnings: true,
    });

    const warningLines = result.warnings.map(
      (w) => `  [${w.severity}] ${w.message}`,
    );
    const lines = [
      result.ok ? "Install: OK" : "Install: FAILED",
      `Source: ${result.source} (${result.sourceKind})`,
      ...(result.modelId ? [`Model id: ${result.modelId}`] : []),
      ...(result.destination ? [`Destination: ${result.destination}`] : []),
      `Profile: ${result.compatibility.profileId}`,
      `Storage: ${result.storage.message}`,
      ...(warningLines.length > 0
        ? ["Compatibility warnings:", ...warningLines]
        : ["Compatibility warnings: (none)"]),
      result.message,
      ...(result.registered
        ? [`Registered: ${result.registered.id} [${result.registered.status}]`]
        : []),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    process.exitCode = result.ok ? (result.warnings.length > 0 ? 0 : 0) : 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
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
