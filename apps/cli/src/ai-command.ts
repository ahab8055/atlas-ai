import { loadConfig } from "@atlas-ai/config";
import {
  checkModelCompatibility,
  createAiRuntime,
  createInferenceConfigManager,
  createModelInstaller,
  createModelStorageManager,
  createSpeechModelManager,
  configFromAtlasDefaults,
  detectHardware,
  evaluateModelSuitability,
  formatCompatibilityReport,
  formatInferenceConfig,
  formatRoutingDecision,
  formatRuntimeSnapshot,
  formatAiRuntimeMetrics,
  formatAiRuntimeRecentEvents,
  formatOfflineModeStatus,
  assessOfflineCapability,
  probeInternetReachability,
  listResourceProfiles,
  recommendModelsForProfile,
  recommendQuantization,
  detectQuantization,
  formatQuantizationInfo,
  formatQuantizationRecommendation,
  formatQuantizationTradeoffs,
  routeModel,
  registerBuiltinProviders,
  InferenceProviderRegistry,
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  SPEECH_MODALITIES,
  type AiRuntime,
  type InferenceConfigPatch,
  type ModelCategory,
  type ModelInfo,
  type RegisteredModel,
  type SpeechModality,
} from "@atlas-ai/ai";

import {
  openModelRegistrySession,
  type ModelRegistryCliOptions,
} from "./model-registry.js";
import { openEmbeddingSession } from "./embedding-session.js";

/**
 * Build an AiRuntime from Atlas config (+ env overrides via loadConfig).
 * When `cliOptions` is provided, enables the pre-run compatibility gate using the registry.
 */
export function createAiRuntimeFromConfig(
  repoRoot?: string,
  cliOptions?: ModelRegistryCliOptions & {
    enforceCompatibility?: boolean;
    enableRouter?: boolean;
  },
): AiRuntime {
  const config = loadConfig(repoRoot ? { repoRoot } : {});
  const enforce = cliOptions?.enforceCompatibility === true;
  const enableRouter = cliOptions?.enableRouter !== false;
  let resolve:
    | ((
        modelId: string,
      ) =>
        | { requirements?: RegisteredModel["requirements"]; sizeBytes?: number }
        | undefined)
    | undefined;
  let listModels: (() => RegisteredModel[]) | undefined;

  if (enforce || enableRouter) {
    const openCatalog = (): RegisteredModel[] => {
      const session = openModelRegistrySession(cliOptions);
      try {
        session.registry.syncFromDisk();
        return session.registry.list();
      } finally {
        session.close();
      }
    };

    if (enableRouter) {
      listModels = openCatalog;
    }

    if (enforce) {
      const models = openCatalog();
      resolve = (modelId: string) => {
        const exact = models.find((m) => m.id === modelId);
        if (exact) {
          return {
            requirements: exact.requirements,
            sizeBytes: exact.sizeBytes,
          };
        }
        const base = modelId.includes("/")
          ? modelId.slice(modelId.lastIndexOf("/") + 1)
          : modelId;
        const match = models.find(
          (m) =>
            m.id === base ||
            m.id.endsWith(`/${base}`) ||
            m.id.replace(/\.gguf$/i, "") === base,
        );
        return match
          ? { requirements: match.requirements, sizeBytes: match.sizeBytes }
          : undefined;
      };
    }
  }

  return createAiRuntime({
    registry: new InferenceProviderRegistry(),
    provider: config.ai.provider,
    endpoint: config.ai.endpoint,
    defaultModelId: config.ai.defaultModelId,
    modelsDir: config.paths.modelsDir,
    dataDir: config.paths.dataDir,
    inference: config.ai.inference,
    hardware: config.ai.hardware,
    llamaCpp: config.ai.llamaCpp,
    features: {
      cloudProviders: config.features.cloudProviders,
      offlineMode: config.features.offlineMode,
    },
    cloudApiKeyPresent: Boolean(
      config.secrets.openaiApiKey || config.secrets.anthropicApiKey,
    ),
    compatibility: enforce
      ? {
          enabled: true,
          modelsDir: config.paths.modelsDir,
          resolve,
        }
      : undefined,
    router:
      enableRouter && listModels
        ? {
            enabled: true,
            listModels,
            fallbackModelId: config.ai.defaultModelId,
          }
        : undefined,
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
      "  atlas ai offline             Offline mode status + limitations",
      "  atlas ai providers           List registered inference providers",
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
      "  atlas ai install … speech --modality stt|tts  Speech nest path",
      "  atlas ai check [modelId]     Verify RAM/CPU/GPU/storage compatibility",
      '  atlas ai route "<prompt>"    Explain automatic model selection for a task',
      "  atlas ai route --model <id> … Manual model selection (explain only)",
      "  atlas ai inference           Show inference settings (temp/tokens/context/stream)",
      "  atlas ai inference set …     Set global or --model overrides (persisted)",
      "  atlas ai runtime             Show loaded models, sessions, memory budget",
      "  atlas ai runtime load|unload Manage model load/unload",
      "  atlas ai runtime reclaim     Unload idle models (no open sessions)",
      "  atlas ai metrics             AI load/inference/memory/error metrics",
      "  atlas ai metrics recent      Recent metric events (this process)",
      "  atlas ai quantization        Detect/recommend GGUF quant levels + tradeoffs",
      '  atlas ai embed "<text>"      Generate a local embedding (mock or llama.cpp)',
      "  atlas ai embed --store …     Generate + persist for search/memory",
      "  atlas ai embeddings          List / search stored embeddings",
      "  atlas ai speech              Speech model storage / STT·TTS prep",
      "  atlas ai speech storage      Ensure speech/stt + speech/tts layout",
      "  atlas ai speech models       List registered speech models",
      "  atlas ai speech register     Scan speech dirs into registry",
      "  atlas ai speech status       Mock STT/TTS provider health",
      "  atlas ai load [modelId]      Validate/load GGUF (default from config)",
      '  atlas ai ask "<prompt>"      Route + load model and generate a reply',
      "",
      "Config: ai.provider, ai.endpoint, ai.defaultModelId, ai.inference, ai.hardware, ai.llamaCpp",
      "Env: ATLAS_AI_PROVIDER, ATLAS_AI_ENDPOINT, ATLAS_AI_DEFAULT_MODEL,",
      "     ATLAS_AI_TEMPERATURE, ATLAS_AI_MAX_TOKENS, ATLAS_AI_CONTEXT_SIZE, ATLAS_AI_STREAM,",
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

  const offlineMatch = /^ai\s+offline\s*$/i.exec(trimmed);
  if (offlineMatch) {
    await handleOffline();
    return true;
  }

  const providersMatch = /^ai\s+providers\s*$/i.exec(trimmed);
  if (providersMatch) {
    await handleProviders();
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

  const installMatch = /^ai\s+install\s+(.+)$/is.exec(trimmed);
  if (installMatch) {
    await handleInstall(installMatch[1]!.trim(), options);
    return true;
  }

  const checkMatch = /^ai\s+check(?:\s+(\S+))?\s*$/i.exec(trimmed);
  if (checkMatch) {
    handleCheck(checkMatch[1], options);
    return true;
  }

  const routeMatch = /^ai\s+route(?:\s+--model\s+(\S+))?\s+(.+)$/is.exec(
    trimmed,
  );
  if (routeMatch) {
    handleRoute(routeMatch[2]!.trim(), routeMatch[1], options);
    return true;
  }

  const inferenceMatch = /^ai\s+inference(?:\s+(.*))?$/is.exec(trimmed);
  if (inferenceMatch) {
    handleInference(inferenceMatch[1]?.trim() ?? "");
    return true;
  }

  const runtimeMatch = /^ai\s+runtime(?:\s+(.*))?$/is.exec(trimmed);
  if (runtimeMatch) {
    await handleRuntime(runtimeMatch[1]?.trim() ?? "", options);
    return true;
  }

  const metricsMatch = /^ai\s+metrics(?:\s+(.*))?$/is.exec(trimmed);
  if (metricsMatch) {
    await handleMetrics(metricsMatch[1]?.trim() ?? "", options);
    return true;
  }

  const quantMatch = /^ai\s+quant(?:ization)?(?:\s+(.*))?$/is.exec(trimmed);
  if (quantMatch) {
    handleQuantization(quantMatch[1]?.trim() ?? "", options);
    return true;
  }

  const embedMatch = /^ai\s+embed(?:\s+(.*))?$/is.exec(trimmed);
  if (embedMatch) {
    await handleEmbed(embedMatch[1]?.trim() ?? "", options);
    return true;
  }

  const embeddingsMatch = /^ai\s+embeddings(?:\s+(.*))?$/is.exec(trimmed);
  if (embeddingsMatch) {
    await handleEmbeddings(embeddingsMatch[1]?.trim() ?? "", options);
    return true;
  }

  const speechMatch = /^ai\s+speech(?:\s+(.*))?$/is.exec(trimmed);
  if (speechMatch) {
    await handleSpeech(speechMatch[1]?.trim() ?? "", options);
    return true;
  }

  const loadMatch = /^ai\s+load(?:\s+(\S+))?\s*$/i.exec(trimmed);
  if (loadMatch) {
    await handleLoad(loadMatch[1], options);
    return true;
  }

  const askMatch = /^ai\s+ask\s+(.+)$/is.exec(trimmed);
  if (askMatch) {
    await handleAsk(askMatch[1]!.trim(), options);
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

  const internetReachable = await probeInternetReachability({
    skip: process.env.ATLAS_OFFLINE_PROBE === "0" || config.env === "test",
    timeoutMs: 1000,
  });
  const offline = assessOfflineCapability({
    offlineMode: config.features.offlineMode,
    cloudProvidersEnabled: config.features.cloudProviders,
    localInferenceReady: health.ok,
    providerId: health.provider,
    internetReachable,
  });

  const out = [
    `AI provider: ${health.provider}`,
    `Healthy: ${health.ok ? "yes" : "no"}`,
    `Message: ${health.message}`,
    ...(health.endpoint ? [`Endpoint: ${health.endpoint}`] : []),
    `Configured provider: ${config.ai.provider}`,
    `Default model: ${config.ai.defaultModelId}`,
    `Models dir: ${config.paths.modelsDir}`,
    `Acceleration: ${hw.acceleration} (gpuLayers=${hw.gpuLayers}, threads=${hw.threads}, ctx=${hw.contextSize})`,
    `Inference: temp=${inf.temperature} maxTokens=${inf.maxTokens} topP=${inf.topP} topK=${inf.topK} repeatPenalty=${inf.repeatPenalty} stream=${inf.stream}`,
    `Manage llama-server: ${config.ai.llamaCpp.manageServer ? "yes" : "no"} (${config.ai.llamaCpp.binary})`,
    `Available providers: ${runtime.listProviders().join(", ")}`,
    ...(active
      ? [`Active model: ${active.id}${active.path ? ` (${active.path})` : ""}`]
      : []),
    `Checked at: ${health.checkedAt}`,
    "",
    formatOfflineModeStatus(offline),
  ];

  process.stdout.write(`${out.join("\n")}\n`);
  process.exitCode = health.ok ? 0 : 1;
}

async function handleOffline(): Promise<void> {
  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig();
  const health = await runtime.health();
  const internetReachable = await probeInternetReachability({
    skip: process.env.ATLAS_OFFLINE_PROBE === "0" || config.env === "test",
    timeoutMs: 1000,
  });
  const offline = assessOfflineCapability({
    offlineMode: config.features.offlineMode,
    cloudProvidersEnabled: config.features.cloudProviders,
    localInferenceReady: health.ok,
    providerId: health.provider,
    internetReachable,
  });
  process.stdout.write(`${formatOfflineModeStatus(offline)}\n`);
  process.exitCode = 0;
}

async function handleProviders(): Promise<void> {
  const config = loadConfig();
  const registry = new InferenceProviderRegistry();
  registerBuiltinProviders(registry, {
    features: {
      cloudProviders: config.features.cloudProviders,
      offlineMode: config.features.offlineMode,
    },
    cloudStub: {
      apiKeyPresent: Boolean(
        config.secrets.openaiApiKey || config.secrets.anthropicApiKey,
      ),
    },
    llamaCpp: {
      baseUrl: config.ai.endpoint,
      modelsDir: config.paths.modelsDir,
      manageServer: config.ai.llamaCpp.manageServer,
      binary: config.ai.llamaCpp.binary,
    },
  });

  const listed = registry.list();
  const out: string[] = [`Inference providers (${listed.length}):`];
  for (const provider of listed) {
    const health = await provider.health();
    const kind = provider.meta?.kind ?? "unknown";
    const net =
      provider.meta?.requiresNetwork === true
        ? "network"
        : provider.meta?.requiresNetwork === false
          ? "local"
          : "?";
    const label = provider.meta?.label ?? provider.id;
    out.push(
      `  - ${provider.id} [${kind}/${net}] ok=${health.ok ? "yes" : "no"} — ${label}`,
    );
    if (!health.ok && health.message) {
      out.push(`      ${health.message}`);
    }
  }

  process.stdout.write(`${out.join("\n")}\n`);
  process.exitCode = 0;
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
        const quant = r.quantization ? ` quant=${r.quantization}` : "";
        return `- [${r.score}] ${r.model.id}${size}${r.sizeClass ? ` class=${r.sizeClass}` : ""}${quant}\n  ${r.reasons.join("; ")}`;
      }),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    process.exitCode = 0;
  } finally {
    session.close();
  }
}

function handleQuantization(
  rest: string,
  options: ModelRegistryCliOptions,
): void {
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  const cmd = parts[0]?.toLowerCase();
  const detected = detectHardware({ skipGpuProbe: true });

  try {
    if (!cmd || cmd === "recommend" || cmd === "rec") {
      const rec = recommendQuantization({ hardware: detected });
      process.stdout.write(`${formatQuantizationRecommendation(rec)}\n`);
      process.exitCode = 0;
      return;
    }

    if (cmd === "tradeoffs" || cmd === "tradeoff") {
      process.stdout.write(`${formatQuantizationTradeoffs()}\n`);
      process.exitCode = 0;
      return;
    }

    if (cmd === "detect" || cmd === "info") {
      const target = parts[1];
      if (!target) {
        throw new Error(
          "Usage: atlas ai quantization detect <modelId-or-filename>",
        );
      }
      const session = openModelRegistrySession(options);
      try {
        session.registry.syncFromDisk();
        const registered =
          session.registry.get(target) ??
          session.registry
            .list()
            .find((m) => m.id.endsWith(`/${target}`) || m.id === target);
        const explicit =
          typeof registered?.requirements?.quantization === "string"
            ? String(registered.requirements.quantization)
            : undefined;
        const info = detectQuantization(
          registered?.location ?? registered?.id ?? target,
          explicit,
        );
        process.stdout.write(`${formatQuantizationInfo(info)}\n`);
        process.exitCode = info.family === "unknown" ? 1 : 0;
      } finally {
        session.close();
      }
      return;
    }

    process.stderr.write(
      [
        "Usage:",
        "  atlas ai quantization              Recommend levels for this machine",
        "  atlas ai quantization detect <id>  Identify quant from model id/path",
        "  atlas ai quantization tradeoffs    Document size/speed/quality tradeoffs",
      ].join("\n") + "\n",
    );
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

function stripEmbedText(raw: string): string {
  let text = raw.trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  return text;
}

async function handleEmbed(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  let store = false;
  let collection = "general";
  let source: string | undefined;
  const textParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === "--store") {
      store = true;
      continue;
    }
    if (p === "--collection" && parts[i + 1]) {
      collection = parts[++i]!;
      continue;
    }
    if (p === "--source" && parts[i + 1]) {
      source = parts[++i]!;
      continue;
    }
    textParts.push(p);
  }

  const text = stripEmbedText(textParts.join(" "));
  if (!text) {
    process.stderr.write(
      'Usage: atlas ai embed [--store] [--collection memory] [--source note] "<text>"\n',
    );
    process.exitCode = 2;
    return;
  }

  const session = openEmbeddingSession(options);
  try {
    if (store) {
      const record = await session.service.embedAndStore(text, {
        collection,
        source,
      });
      process.stdout.write(
        [
          `Stored embedding: ${record.id}`,
          `Provider: ${record.provider} (independent of chat)`,
          `Model: ${record.modelId}`,
          `Dimensions: ${record.dimensions}`,
          `Collection: ${record.collection}`,
          ...(record.source ? [`Source: ${record.source}`] : []),
        ].join("\n") + "\n",
      );
    } else {
      const result = await session.service.embed(text);
      const preview = result.embedding
        .slice(0, 8)
        .map((v) => v.toFixed(4))
        .join(", ");
      process.stdout.write(
        [
          `Embedding OK (${result.provider})`,
          `Model: ${result.modelId}`,
          `Dimensions: ${result.dimensions}`,
          `Duration: ${result.durationMs}ms`,
          `Preview: [${preview}, …]`,
        ].join("\n") + "\n",
      );
    }
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    session.close();
  }
}

async function handleEmbeddings(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  const cmd = parts[0]?.toLowerCase();
  const session = openEmbeddingSession(options);

  try {
    if (!cmd || cmd === "list") {
      const collection = parts[1];
      const rows = session.service.list(
        collection ? { collection, limit: 50 } : { limit: 50 },
      );
      if (rows.length === 0) {
        process.stdout.write(
          'No stored embeddings. Use: atlas ai embed --store "…"\n',
        );
      } else {
        process.stdout.write(
          [
            `Embeddings (${rows.length}):`,
            ...rows.map(
              (r) =>
                `- ${r.id} [${r.collection}] dims=${r.dimensions} model=${r.modelId}\n  ${r.content.slice(0, 80)}${r.content.length > 80 ? "…" : ""}`,
            ),
          ].join("\n") + "\n",
        );
      }
      process.exitCode = 0;
      return;
    }

    if (cmd === "search") {
      const query = stripEmbedText(parts.slice(1).join(" "));
      if (!query) {
        throw new Error('Usage: atlas ai embeddings search "<query>"');
      }
      const matches = await session.service.findSimilar(query, { limit: 5 });
      if (matches.length === 0) {
        process.stdout.write("No similar embeddings found.\n");
      } else {
        process.stdout.write(
          [
            `Similar (${matches.length}):`,
            ...matches.map(
              (m) =>
                `- [${m.score.toFixed(3)}] ${m.record.id} (${m.record.collection})\n  ${m.record.content.slice(0, 100)}`,
            ),
          ].join("\n") + "\n",
        );
      }
      process.exitCode = 0;
      return;
    }

    if (cmd === "remove" || cmd === "delete") {
      const id = parts[1];
      if (!id) {
        throw new Error("Usage: atlas ai embeddings remove <id>");
      }
      const ok = session.service.remove(id);
      process.stdout.write(ok ? `Removed ${id}\n` : `Not found: ${id}\n`);
      process.exitCode = ok ? 0 : 1;
      return;
    }

    process.stderr.write(
      [
        "Usage:",
        "  atlas ai embeddings list [collection]",
        '  atlas ai embeddings search "<query>"',
        "  atlas ai embeddings remove <id>",
      ].join("\n") + "\n",
    );
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    session.close();
  }
}

async function handleSpeech(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  const cmd = parts[0]?.toLowerCase();
  const config = loadConfig();
  const session = openModelRegistrySession(options);

  try {
    const manager = createSpeechModelManager({
      modelsDir: config.paths.modelsDir,
      registry: session.registry,
    });

    if (cmd === "help" || cmd === "--help" || cmd === "-h") {
      process.stdout.write(
        [
          "Speech model prep (Architecture/08 / 25):",
          "  atlas ai speech                 Overview + layout status",
          "  atlas ai speech storage         Ensure models/speech/{stt,tts}",
          "  atlas ai speech models [stt|tts] List registered speech models",
          "  atlas ai speech register        Scan speech dirs → registry",
          "  atlas ai speech status          Mock STT/TTS provider health",
          "",
          "Install into nested speech dirs:",
          "  atlas ai install ./whisper.gguf speech --modality stt",
          "  atlas ai install ./piper.gguf speech --modality tts",
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "storage") {
      const result = manager.ensureStructure();
      const files = manager.listFiles();
      process.stdout.write(
        [
          `Speech layout: ${result.speechDir}`,
          `Ready: ${manager.isStructureReady() ? "yes" : "no"}`,
          `Created: ${result.created.length}`,
          `Files on disk: ${files.length}`,
          ...files.map(
            (f) =>
              `  - ${f.id} [${f.modality}/${f.format}] ${formatBytes(f.sizeBytes)}${f.valid ? "" : " INVALID"}`,
          ),
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "models") {
      const modalityRaw = parts[1]?.toLowerCase();
      const modality =
        modalityRaw &&
        (SPEECH_MODALITIES as readonly string[]).includes(modalityRaw)
          ? (modalityRaw as SpeechModality)
          : undefined;
      const rows = manager.list(modality ? { modality } : undefined);
      if (rows.length === 0) {
        process.stdout.write(
          "No registered speech models. Place weights under models/speech/{stt,tts} then: atlas ai speech register\n",
        );
      } else {
        process.stdout.write(
          [
            `Speech models (${rows.length})${modality ? ` [${modality}]` : ""}:`,
            ...rows.map(
              (m) =>
                `- ${m.id} [${m.modality}] ${m.format} status=${m.status} langs=${m.metadata.languages.join(",")}`,
            ),
          ].join("\n") + "\n",
        );
      }
      process.exitCode = 0;
      return;
    }

    if (cmd === "register") {
      const count = manager.syncFromDisk();
      process.stdout.write(
        `Registered/synced ${count} speech model(s) from disk.\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "status") {
      const stt = new MockSpeechToTextProvider();
      const tts = new MockTextToSpeechProvider();
      const [sttHealth, ttsHealth] = await Promise.all([
        stt.health(),
        tts.health(),
      ]);
      process.stdout.write(
        [
          "Speech providers (mock — no Whisper/Piper runtime yet):",
          `  STT: ${sttHealth.provider} ok=${sttHealth.ok} ${sttHealth.message ?? ""}`,
          `  TTS: ${ttsHealth.provider} ok=${ttsHealth.ok} ${ttsHealth.message ?? ""}`,
          `Layout ready: ${manager.isStructureReady() ? "yes" : "no (run: atlas ai speech storage)"}`,
          `Registered speech models: ${manager.list().length}`,
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    if (!cmd) {
      const structure = manager.ensureStructure();
      process.stdout.write(
        [
          "Speech model foundation",
          `  Dir: ${structure.speechDir}`,
          `  Nested: speech/stt, speech/tts`,
          `  Ready: ${manager.isStructureReady() ? "yes" : "no"}`,
          `  On disk: ${manager.listFiles().length} file(s)`,
          `  Registered: ${manager.list().length}`,
          "",
          "Commands: storage | models [stt|tts] | register | status | help",
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    process.stderr.write(
      [
        `Unknown speech command: ${cmd}`,
        "Usage: atlas ai speech [storage|models|register|status|help]",
      ].join("\n") + "\n",
    );
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    session.close();
  }
}

async function handleInstall(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const tokens = rest.split(/\s+/).filter(Boolean);
  let dryRun = false;
  let speechModality: SpeechModality | undefined;
  const positional: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "--dry-run" || t === "--check") {
      dryRun = true;
      continue;
    }
    if (t === "--modality" && tokens[i + 1]) {
      const raw = tokens[++i]!.toLowerCase();
      if (!(SPEECH_MODALITIES as readonly string[]).includes(raw)) {
        process.stderr.write(`Invalid --modality "${raw}". Use: stt | tts\n`);
        process.exitCode = 2;
        return;
      }
      speechModality = raw as SpeechModality;
      continue;
    }
    if (t.startsWith("--modality=")) {
      const raw = t.slice("--modality=".length).toLowerCase();
      if (!(SPEECH_MODALITIES as readonly string[]).includes(raw)) {
        process.stderr.write(`Invalid --modality "${raw}". Use: stt | tts\n`);
        process.exitCode = 2;
        return;
      }
      speechModality = raw as SpeechModality;
      continue;
    }
    positional.push(t);
  }

  const source = positional[0];
  const categoryRaw = positional[1];
  if (!source) {
    process.stderr.write(
      "Usage: atlas ai install [--dry-run] [--modality stt|tts] <source> [category]\n",
    );
    process.exitCode = 2;
    return;
  }

  const config = loadConfig();
  const category = (categoryRaw ?? "general") as ModelCategory;
  if (speechModality && category !== "speech") {
    process.stderr.write("--modality applies only when category is speech\n");
    process.exitCode = 2;
    return;
  }

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
      offlineMode: config.features.offlineMode,
      ...(category === "speech"
        ? { speechModality: speechModality ?? "stt" }
        : {}),
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
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    session.close();
  }
}

function handleCheck(
  modelId: string | undefined,
  options: ModelRegistryCliOptions,
): void {
  const config = loadConfig();
  const id = modelId ?? config.ai.defaultModelId;
  const session = openModelRegistrySession(options);
  try {
    session.registry.syncFromDisk();
    const registered =
      session.registry.get(id) ??
      session.registry
        .list()
        .find((m) => m.id.endsWith(`/${id}`) || m.id === id);

    const result = checkModelCompatibility({
      modelId: id,
      requirements: registered?.requirements,
      sizeBytes: registered?.sizeBytes,
      modelsDir: config.paths.modelsDir,
      mode: "runtime",
    });

    process.stdout.write(`${formatCompatibilityReport(result)}\n`);
    if (!registered) {
      process.stdout.write(
        `(No registry entry for ${id} — checked with empty/partial requirements. Run atlas ai register.)\n`,
      );
    }
    process.exitCode = result.compatible ? 0 : 1;
  } finally {
    session.close();
  }
}

function stripQuotedPrompt(promptRaw: string): string {
  let prompt = promptRaw.trim();
  if (
    (prompt.startsWith('"') && prompt.endsWith('"')) ||
    (prompt.startsWith("'") && prompt.endsWith("'"))
  ) {
    prompt = prompt.slice(1, -1);
  }
  return prompt;
}

function handleRoute(
  promptRaw: string,
  manualModelId: string | undefined,
  options: ModelRegistryCliOptions,
): void {
  const config = loadConfig();
  const prompt = stripQuotedPrompt(promptRaw);
  if (!prompt) {
    process.stderr.write('Usage: atlas ai route "<prompt>"\n');
    process.exitCode = 2;
    return;
  }

  const session = openModelRegistrySession(options);
  try {
    session.registry.syncFromDisk();
    const decision = routeModel({
      prompt,
      models: session.registry.list(),
      preferredModelId: manualModelId,
      mode: manualModelId ? "manual" : "auto",
      fallbackModelId: config.ai.defaultModelId,
    });
    process.stdout.write(`${formatRoutingDecision(decision)}\n`);
    process.exitCode = decision.routed ? 0 : 1;
  } finally {
    session.close();
  }
}

async function handleLoad(
  modelId: string | undefined,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig(undefined, {
    ...options,
    enforceCompatibility: true,
  });
  try {
    const hw = detectHardware({ skipGpuProbe: true });
    runtime.getModelRuntime().setHostMemory({
      totalBytes: hw.memory.totalBytes,
      freeBytes: hw.memory.freeBytes,
    });
    const loaded = await runtime.loadModel(modelId ?? config.ai.defaultModelId);
    process.stdout.write(
      [
        `Loaded model: ${loaded.id}`,
        `Format: ${loaded.format}`,
        `Status: ${loaded.status}`,
        ...(loaded.path ? [`Path: ${loaded.path}`] : []),
        `Provider: ${loaded.provider}`,
        formatRuntimeSnapshot(runtime.getRuntimeSnapshot()),
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

async function handleMetrics(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  const cmd = parts[0]?.toLowerCase();
  const runtime = createAiRuntimeFromConfig(undefined, {
    ...options,
    enforceCompatibility: true,
  });
  const hw = detectHardware({ skipGpuProbe: true });
  runtime.getModelRuntime().setHostMemory({
    totalBytes: hw.memory.totalBytes,
    freeBytes: hw.memory.freeBytes,
  });

  try {
    if (cmd === "help" || cmd === "--help" || cmd === "-h") {
      process.stdout.write(
        [
          "AI runtime metrics (Architecture/15 / 25):",
          "  atlas ai metrics           Aggregates + warnings (this process)",
          "  atlas ai metrics recent    Recent metric events",
          "",
          "Note: metrics are process-scoped (same as atlas ai runtime).",
          "Use after load/ask in the same process, or via AiRuntime.getMetrics().",
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "recent" || cmd === "events") {
      const limitRaw = parts[1];
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
      process.stdout.write(
        `${formatAiRuntimeRecentEvents(
          runtime.getRecentMetricEvents(Number.isFinite(limit) ? limit : 20),
        )}\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd && cmd !== "show" && cmd !== "status") {
      process.stderr.write(
        `Unknown metrics command: ${cmd}\nUsage: atlas ai metrics [recent|help]\n`,
      );
      process.exitCode = 2;
      return;
    }

    process.stdout.write(`${formatAiRuntimeMetrics(runtime.getMetrics())}\n`);
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

async function handleRuntime(
  rest: string,
  options: ModelRegistryCliOptions,
): Promise<void> {
  const config = loadConfig();
  const runtime = createAiRuntimeFromConfig(undefined, {
    ...options,
    enforceCompatibility: true,
  });
  const hw = detectHardware({ skipGpuProbe: true });
  runtime.getModelRuntime().setHostMemory({
    totalBytes: hw.memory.totalBytes,
    freeBytes: hw.memory.freeBytes,
  });
  if (
    runtime.getModelRuntime().getSnapshot().memory.budgetBytes === undefined
  ) {
    runtime
      .getModelRuntime()
      .setMemoryBudgetBytes(Math.floor(hw.memory.totalBytes * 0.5));
  }

  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];
  const cmd = parts[0]?.toLowerCase();

  try {
    if (!cmd || cmd === "status" || cmd === "show") {
      process.stdout.write(
        `${formatRuntimeSnapshot(runtime.getRuntimeSnapshot())}\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "load") {
      const modelId = parts[1] ?? config.ai.defaultModelId;
      const loaded = await runtime.loadModel(modelId);
      process.stdout.write(
        `Loaded: ${loaded.id}\n${formatRuntimeSnapshot(runtime.getRuntimeSnapshot())}\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "unload") {
      await runtime.unloadModel(parts[1]);
      process.stdout.write(
        `Unloaded${parts[1] ? `: ${parts[1]}` : ""}\n${formatRuntimeSnapshot(runtime.getRuntimeSnapshot())}\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "reclaim" || cmd === "gc") {
      const unloaded = await runtime.reclaimIdleModels();
      process.stdout.write(
        [
          unloaded.length > 0
            ? `Reclaimed: ${unloaded.join(", ")}`
            : "Reclaimed: (none idle)",
          formatRuntimeSnapshot(runtime.getRuntimeSnapshot()),
        ].join("\n") + "\n",
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "sessions") {
      const sessions = runtime.getModelRuntime().listSessions();
      if (sessions.length === 0) {
        process.stdout.write("Sessions: (none)\n");
      } else {
        process.stdout.write(
          [
            "Sessions:",
            ...sessions.map(
              (s) =>
                `- ${s.id} [${s.status}] model=${s.modelId} inferences=${s.inferenceCount}`,
            ),
          ].join("\n") + "\n",
        );
      }
      process.exitCode = 0;
      return;
    }

    if (cmd === "session" && parts[1]?.toLowerCase() === "start") {
      const modelId = parts[2] ?? config.ai.defaultModelId;
      const session = await runtime.createInferenceSession(modelId);
      process.stdout.write(
        `Session started: ${session.id} (model=${session.modelId})\n`,
      );
      process.exitCode = 0;
      return;
    }

    if (cmd === "session" && parts[1]?.toLowerCase() === "end") {
      const sessionId = parts[2];
      if (!sessionId) {
        throw new Error("Usage: atlas ai runtime session end <sessionId>");
      }
      const ok = runtime.endInferenceSession(sessionId);
      process.stdout.write(
        ok
          ? `Session closed: ${sessionId}\n`
          : `Session not found: ${sessionId}\n`,
      );
      process.exitCode = ok ? 0 : 1;
      return;
    }

    process.stderr.write(
      [
        "Usage:",
        "  atlas ai runtime",
        "  atlas ai runtime load [modelId]",
        "  atlas ai runtime unload [modelId]",
        "  atlas ai runtime reclaim",
        "  atlas ai runtime sessions",
        "  atlas ai runtime session start [modelId]",
        "  atlas ai runtime session end <sessionId>",
      ].join("\n") + "\n",
    );
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

function openInferenceManager() {
  const config = loadConfig();
  return createInferenceConfigManager({
    base: configFromAtlasDefaults({
      inference: config.ai.inference,
      contextLength: config.ai.hardware.contextSize,
    }),
    dataDir: config.paths.dataDir,
  });
}

function parseInferenceKv(args: string[]): InferenceConfigPatch {
  const patch: InferenceConfigPatch = {};
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Expected key=value, got: ${arg}`);
    }
    const key = arg.slice(0, eq);
    const value = arg.slice(eq + 1);
    switch (key) {
      case "temperature":
      case "temp":
        patch.temperature = Number(value);
        break;
      case "maxTokens":
      case "max_tokens":
        patch.maxTokens = Number(value);
        break;
      case "contextLength":
      case "context":
      case "contextSize":
        patch.contextLength = Number(value);
        break;
      case "topP":
      case "top_p":
        patch.topP = Number(value);
        break;
      case "topK":
      case "top_k":
        patch.topK = Number(value);
        break;
      case "repeatPenalty":
      case "repeat_penalty":
        patch.repeatPenalty = Number(value);
        break;
      case "stream":
        patch.stream = value === "true" || value === "1";
        break;
      default:
        throw new Error(`Unknown inference key: ${key}`);
    }
  }
  return patch;
}

function handleInference(rest: string): void {
  const manager = openInferenceManager();
  const parts = rest.length > 0 ? rest.split(/\s+/).filter(Boolean) : [];

  try {
    if (parts.length === 0 || parts[0] === "show" || parts[0] === "get") {
      const modelId =
        parts[0] === "get" || parts[0] === "show" ? parts[1] : undefined;
      const resolved = manager.resolve(modelId);
      const modelOverrides = manager.listModelOverrides();
      const lines = [
        formatInferenceConfig(resolved),
        `Store: ${manager.getStorePath()}`,
        ...(modelOverrides.length > 0
          ? [`Model overrides: ${modelOverrides.join(", ")}`]
          : ["Model overrides: (none)"]),
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
      process.exitCode = 0;
      return;
    }

    if (parts[0] === "set") {
      let modelId: string | undefined;
      const kvArgs = parts.slice(1);
      const modelFlag = kvArgs.indexOf("--model");
      if (modelFlag >= 0) {
        modelId = kvArgs[modelFlag + 1];
        if (!modelId) {
          throw new Error(
            "Usage: atlas ai inference set --model <id> key=value …",
          );
        }
        kvArgs.splice(modelFlag, 2);
      }
      if (kvArgs.length === 0) {
        throw new Error(
          "Usage: atlas ai inference set [--model <id>] temperature=0.7 maxTokens=256 …",
        );
      }
      const patch = parseInferenceKv(kvArgs);
      const resolved = modelId
        ? manager.setForModel(modelId, patch)
        : manager.setGlobal(patch);
      process.stdout.write(`${formatInferenceConfig(resolved)}\n`);
      process.stdout.write(`Saved to ${manager.getStorePath()}\n`);
      process.exitCode = 0;
      return;
    }

    if (parts[0] === "reset") {
      const modelFlag = parts.indexOf("--model");
      if (modelFlag >= 0) {
        const modelId = parts[modelFlag + 1];
        if (!modelId) {
          throw new Error("Usage: atlas ai inference reset --model <id>");
        }
        manager.clearForModel(modelId);
        process.stdout.write(`Cleared overrides for ${modelId}\n`);
      } else if (parts[1] === "global") {
        manager.clearGlobal();
        process.stdout.write("Cleared global overrides\n");
      } else {
        manager.resetAll();
        process.stdout.write("Cleared all persisted inference overrides\n");
      }
      process.exitCode = 0;
      return;
    }

    process.stderr.write(
      [
        "Usage:",
        "  atlas ai inference",
        "  atlas ai inference get [modelId]",
        "  atlas ai inference set [--model <id>] temperature=0.7 maxTokens=512 contextLength=8192 stream=true",
        "  atlas ai inference reset [--model <id>|global]",
      ].join("\n") + "\n",
    );
    process.exitCode = 2;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

async function handleAsk(
  promptRaw: string,
  options: ModelRegistryCliOptions = { enableDatabase: true },
): Promise<void> {
  const prompt = stripQuotedPrompt(promptRaw);
  if (!prompt) {
    process.stderr.write('Usage: atlas ai ask "<prompt>"\n');
    process.exitCode = 2;
    return;
  }

  const runtime = createAiRuntimeFromConfig(undefined, {
    ...options,
    enforceCompatibility: true,
    enableRouter: true,
  });
  try {
    const decision = runtime.route({ prompt });
    if (process.env.ATLAS_CLI_DEBUG === "1") {
      process.stderr.write(`${formatRoutingDecision(decision)}\n`);
    }
    const modelId = decision.modelId;
    const messages = [{ role: "user" as const, content: prompt }];
    if (runtime.prefersStreaming(modelId)) {
      let text = "";
      for await (const chunk of runtime.stream({ messages, modelId })) {
        if (chunk.text) {
          process.stdout.write(chunk.text);
          text += chunk.text;
        }
      }
      if (!text.endsWith("\n")) {
        process.stdout.write("\n");
      }
      if (process.env.ATLAS_CLI_DEBUG === "1") {
        process.stderr.write(`[ai] streamed model=${modelId ?? "(default)"}\n`);
      }
    } else {
      const result = await runtime.generate({ messages, modelId });
      process.stdout.write(`${result.text}\n`);
      if (process.env.ATLAS_CLI_DEBUG === "1") {
        process.stderr.write(
          `[ai] provider=${result.provider} model=${result.modelId} ${result.durationMs}ms\n`,
        );
      }
    }
    process.exitCode = 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
