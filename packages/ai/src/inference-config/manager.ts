/**
 * Inference Configuration Manager — configure, persist, resolve per model.
 */
import {
  createFileInferenceSettingsStore,
  createMemoryInferenceSettingsStore,
  type InferenceSettingsStore,
} from "./store.js";
import { formatInferenceConfig, resolveInferenceConfig } from "./resolve.js";
import {
  configFromAtlasDefaults,
  emptyStoredSettings,
  mergeInferenceConfig,
  sanitizeInferencePatch,
} from "./validate.js";
import type {
  InferenceConfig,
  InferenceConfigPatch,
  ResolvedInferenceConfig,
  StoredInferenceSettings,
} from "./types.js";
import { DEFAULT_INFERENCE_CONFIG } from "./types.js";

export interface InferenceConfigManagerOptions {
  /** Atlas / built-in baseline (from config/*.json). */
  base?: InferenceConfig;
  /** Persist under `{dataDir}/inference-settings.json`. */
  dataDir?: string;
  /** Inject store (tests). */
  store?: InferenceSettingsStore;
}

export class InferenceConfigManager {
  private base: InferenceConfig;
  private readonly store: InferenceSettingsStore;

  constructor(options: InferenceConfigManagerOptions = {}) {
    this.base = options.base
      ? mergeInferenceConfig(DEFAULT_INFERENCE_CONFIG, options.base)
      : mergeInferenceConfig(DEFAULT_INFERENCE_CONFIG);
    this.store =
      options.store ??
      (options.dataDir
        ? createFileInferenceSettingsStore(options.dataDir)
        : createMemoryInferenceSettingsStore());
  }

  getStorePath(): string {
    return this.store.path;
  }

  getBase(): InferenceConfig {
    return mergeInferenceConfig(this.base);
  }

  setBase(patch: InferenceConfigPatch): InferenceConfig {
    this.base = mergeInferenceConfig(this.base, sanitizeInferencePatch(patch));
    return this.getBase();
  }

  loadStored(): StoredInferenceSettings {
    return this.store.load();
  }

  /**
   * Resolve effective settings for optional model + request overrides.
   */
  resolve(
    modelId?: string,
    request?: InferenceConfigPatch,
  ): ResolvedInferenceConfig {
    return resolveInferenceConfig({
      base: this.base,
      stored: this.store.load(),
      modelId,
      request,
    });
  }

  /** Update global persisted overrides (safe, validated). */
  setGlobal(patch: InferenceConfigPatch): ResolvedInferenceConfig {
    const stored = this.store.load();
    const next: StoredInferenceSettings = {
      ...stored,
      global: {
        ...stored.global,
        ...sanitizeInferencePatch(patch),
      },
      updatedAt: new Date().toISOString(),
    };
    this.store.save(next);
    return this.resolve();
  }

  /** Update per-model overrides. */
  setForModel(
    modelId: string,
    patch: InferenceConfigPatch,
  ): ResolvedInferenceConfig {
    const id = modelId.trim();
    if (!id) {
      throw new Error("modelId is required");
    }
    if (id.includes("..") || id.startsWith("/") || id.includes("\0")) {
      throw new Error("Invalid modelId for inference settings");
    }
    const stored = this.store.load();
    const next: StoredInferenceSettings = {
      ...stored,
      models: {
        ...stored.models,
        [id]: {
          ...stored.models[id],
          ...sanitizeInferencePatch(patch),
        },
      },
      updatedAt: new Date().toISOString(),
    };
    this.store.save(next);
    return this.resolve(id);
  }

  clearGlobal(): void {
    const stored = this.store.load();
    const next: StoredInferenceSettings = {
      ...stored,
      global: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.store.save(next);
  }

  clearForModel(modelId: string): void {
    const stored = this.store.load();
    const models = { ...stored.models };
    delete models[modelId];
    this.store.save({
      ...stored,
      models,
      updatedAt: new Date().toISOString(),
    });
  }

  resetAll(): void {
    this.store.save(emptyStoredSettings());
  }

  listModelOverrides(): string[] {
    return Object.keys(this.store.load().models).sort();
  }
}

export function createInferenceConfigManager(
  options: InferenceConfigManagerOptions = {},
): InferenceConfigManager {
  return new InferenceConfigManager(options);
}

export {
  configFromAtlasDefaults,
  formatInferenceConfig,
  resolveInferenceConfig,
};
