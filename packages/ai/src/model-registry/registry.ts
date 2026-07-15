import { scanInstalledGgufModels } from "./discover.js";
import { InMemoryModelRegistryStore } from "./memory-store.js";
import type {
  ModelRegistryQuery,
  ModelRegistryStore,
  RegisterModelInput,
  RegisteredModel,
} from "./types.js";

export interface ModelRegistryOptions {
  store?: ModelRegistryStore;
  modelsDir?: string;
  defaultProvider?: string;
  defaultContextLength?: number;
}

/**
 * Model registry — register / query installed models (Architecture/25).
 * Persistence is pluggable (memory or SQLite via adapter).
 */
export class ModelRegistry {
  private readonly store: ModelRegistryStore;
  private readonly modelsDir?: string;
  private readonly defaultProvider: string;
  private readonly defaultContextLength: number;

  constructor(options: ModelRegistryOptions = {}) {
    this.store = options.store ?? new InMemoryModelRegistryStore();
    this.modelsDir = options.modelsDir;
    this.defaultProvider = options.defaultProvider ?? "llamacpp";
    this.defaultContextLength = options.defaultContextLength ?? 4096;
  }

  /** Register or update a model (installed entry). */
  register(input: RegisterModelInput): RegisteredModel {
    return this.store.upsert({
      ...input,
      version: input.version ?? "1.0.0",
      format: input.format ?? "unknown",
      status: input.status ?? "available",
      capabilities: input.capabilities ?? [],
      requirements: input.requirements ?? {},
    });
  }

  get(id: string): RegisteredModel | undefined {
    return this.store.get(id);
  }

  /** Query available / filtered models. */
  list(query: ModelRegistryQuery = {}): RegisteredModel[] {
    return this.store.list(query);
  }

  remove(id: string): boolean {
    return this.store.remove(id);
  }

  /**
   * Scan `modelsDir` for GGUF files and upsert into the registry.
   * Returns the number of models registered.
   */
  syncFromDisk(modelsDir = this.modelsDir): number {
    if (!modelsDir) {
      return 0;
    }
    const discovered = scanInstalledGgufModels({
      modelsDir,
      provider: this.defaultProvider,
      defaultContextLength: this.defaultContextLength,
    });
    for (const model of discovered) {
      this.register(model);
    }
    return discovered.length;
  }
}

export function createModelRegistry(
  options: ModelRegistryOptions = {},
): ModelRegistry {
  return new ModelRegistry(options);
}
