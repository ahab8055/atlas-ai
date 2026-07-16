import { loadConfig } from "@atlas-ai/config";
import {
  checkModelCompatibility,
  createAiRuntime,
  createInferenceConfigManager,
  createModelInstaller,
  createModelStorageManager,
  configFromAtlasDefaults,
  detectHardware,
  evaluateModelSuitability,
  formatCompatibilityReport,
  formatInferenceConfig,
  formatRoutingDecision,
  listResourceProfiles,
  recommendModelsForProfile,
  routeModel,
  InferenceProviderRegistry,
  type AiRuntime,
  type InferenceConfigPatch,
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
      "  atlas ai check [modelId]     Verify RAM/CPU/GPU/storage compatibility",
      '  atlas ai route "<prompt>"    Explain automatic model selection for a task',
      "  atlas ai route --model <id> … Manual model selection (explain only)",
      "  atlas ai inference           Show inference settings (temp/tokens/context/stream)",
      "  atlas ai inference set …     Set global or --model overrides (persisted)",
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
