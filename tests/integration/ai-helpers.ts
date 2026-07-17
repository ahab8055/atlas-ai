/**
 * Shared harness for Phase 2 Local AI Engine integration tests.
 * Isolated registry + mock runtime; optional temp models dir for install paths.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AiRuntime,
  InferenceProviderRegistry,
  createAiRuntime,
  createModelRegistry,
  type ModelRegistry,
  type RegisteredModel,
} from "@atlas-ai/ai";

export interface LocalAiHarnessOptions {
  /** Default mock-general. */
  defaultModelId?: string;
  offlineMode?: boolean;
  cloudProviders?: boolean;
  /** Inject router catalog (coding/general fixtures). */
  routerCatalog?: RegisteredModel[];
  /** Create a temp modelsDir + ModelRegistry for install tests. */
  withModelsDir?: boolean;
}

export interface LocalAiHarness {
  runtime: AiRuntime;
  registry: InferenceProviderRegistry;
  modelsDir?: string;
  modelRegistry?: ModelRegistry;
  catalog: RegisteredModel[];
  cleanup: () => void;
}

/** Fixture catalog for routing integration tests. */
export function createRouterCatalog(): RegisteredModel[] {
  const now = new Date().toISOString();
  return [
    {
      id: "mock-general",
      name: "Mock General",
      version: "1.0.0",
      format: "gguf",
      sizeBytes: 2 * 1024 ** 3,
      capabilities: ["chat", "local", "general"],
      requirements: { minRamGb: 4, acceleration: "cpu" },
      provider: "mock",
      status: "available",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mock-coding",
      name: "Mock Coding",
      version: "1.0.0",
      format: "gguf",
      sizeBytes: 4 * 1024 ** 3,
      capabilities: ["chat", "local", "coding"],
      requirements: { minRamGb: 8, acceleration: "cpu" },
      provider: "mock",
      status: "available",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createLocalAiHarness(
  options: LocalAiHarnessOptions = {},
): LocalAiHarness {
  const offlineMode = options.offlineMode !== false;
  const cloudProviders = options.cloudProviders === true;
  const catalog = options.routerCatalog ?? createRouterCatalog();
  const providerRegistry = new InferenceProviderRegistry();

  let modelsDir: string | undefined;
  let modelRegistry: ModelRegistry | undefined;
  const cleanups: Array<() => void> = [];

  if (options.withModelsDir) {
    modelsDir = mkdtempSync(join(tmpdir(), "atlas-phase2-ai-"));
    mkdirSync(modelsDir, { recursive: true });
    modelRegistry = createModelRegistry({ modelsDir });
    cleanups.push(() => {
      rmSync(modelsDir!, { recursive: true, force: true });
    });
  }

  const runtime = createAiRuntime({
    registry: providerRegistry,
    provider: "mock",
    defaultModelId: options.defaultModelId ?? "mock-general",
    modelsDir,
    features: {
      offlineMode,
      cloudProviders,
    },
    router: {
      enabled: true,
      listModels: () => catalog,
      fallbackModelId: options.defaultModelId ?? "mock-general",
      skipGpuProbe: true,
    },
  });

  return {
    runtime,
    registry: providerRegistry,
    modelsDir,
    modelRegistry,
    catalog,
    cleanup: () => {
      for (const fn of cleanups.reverse()) {
        fn();
      }
    },
  };
}
