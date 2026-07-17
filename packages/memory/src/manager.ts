/**
 * Memory Manager — central facade over typed providers (Architecture/04).
 */
import { MemoryError } from "./errors.js";
import type { MemoryProvider } from "./provider.js";
import {
  getDefaultMemoryProviderRegistry,
  MemoryProviderRegistry,
} from "./registry.js";
import { registerBuiltinMemoryProviders } from "./providers/register.js";
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  MemorySnippetView,
  MemoryType,
  UpdateMemoryInput,
} from "./types.js";
import { MEMORY_TYPES, scopeForType } from "./types.js";

export interface MemoryManagerOptions {
  registry?: MemoryProviderRegistry;
  /** Skip registering builtins when injecting a fully configured registry. */
  skipBuiltins?: boolean;
}

export class MemoryManager {
  private readonly registry: MemoryProviderRegistry;

  constructor(options: MemoryManagerOptions = {}) {
    this.registry = options.registry ?? new MemoryProviderRegistry();
    if (!options.skipBuiltins) {
      registerBuiltinMemoryProviders(this.registry);
    }
  }

  getRegistry(): MemoryProviderRegistry {
    return this.registry;
  }

  listTypes(): MemoryType[] {
    return this.registry.types();
  }

  async store(input: CreateMemoryInput): Promise<MemoryRecord> {
    return this.registry.require(input.type).store(input);
  }

  async get(id: string, type?: MemoryType): Promise<MemoryRecord | undefined> {
    if (type) {
      return this.registry.require(type).get(id);
    }
    for (const provider of this.registry.all()) {
      const found = await provider.get(id);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  async update(
    id: string,
    patch: UpdateMemoryInput,
    type?: MemoryType,
  ): Promise<MemoryRecord> {
    if (type) {
      return this.registry.require(type).update(id, patch);
    }
    const existing = await this.get(id);
    if (!existing) {
      throw MemoryError.notFound(id);
    }
    return this.registry.require(existing.type).update(id, patch);
  }

  async delete(id: string, type?: MemoryType): Promise<boolean> {
    if (type) {
      return this.registry.require(type).delete(id);
    }
    for (const provider of this.registry.all()) {
      if (await provider.delete(id)) {
        return true;
      }
    }
    return false;
  }

  async query(query: MemoryQuery = {}): Promise<MemoryRecord[]> {
    const providers = this.providersForQuery(query);
    const batches = await Promise.all(providers.map((p) => p.query(query)));
    let merged = batches.flat();

    if (query.scope) {
      merged = merged.filter((r) => r.scope === query.scope);
    }

    merged.sort((a, b) => {
      const scoreDiff = scoreRecord(b, query.text) - scoreRecord(a, query.text);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    const limit = query.limit ?? merged.length;
    return merged.slice(0, Math.max(0, limit));
  }

  async clear(
    type?: MemoryType,
    options?: ClearMemoryOptions,
  ): Promise<number> {
    if (type) {
      return this.registry.require(type).clear(options);
    }
    let total = 0;
    for (const provider of this.registry.all()) {
      total += await provider.clear(options);
    }
    return total;
  }

  private providersForQuery(query: MemoryQuery): MemoryProvider[] {
    if (query.type) {
      return [this.registry.require(query.type)];
    }
    if (query.scope === "short_term") {
      return [this.registry.require("working")];
    }
    if (query.scope === "long_term") {
      return MEMORY_TYPES.filter((t) => scopeForType(t) === "long_term")
        .map((t) => this.registry.get(t))
        .filter((p): p is MemoryProvider => p !== undefined);
    }
    return this.registry.all();
  }
}

function scoreRecord(record: MemoryRecord, text?: string): number {
  let score = record.importance ?? 0.5;
  if (text?.trim()) {
    const needle = text.trim().toLowerCase();
    if (record.content.toLowerCase().includes(needle)) {
      score += 1;
    }
  }
  if (record.confidence !== undefined) {
    score += record.confidence * 0.1;
  }
  return score;
}

/** Map records to core-compatible MemorySnippet shape. */
export function toMemorySnippets(
  records: MemoryRecord[],
  text?: string,
): MemorySnippetView[] {
  return records.map((r) => ({
    id: r.id,
    content: r.content,
    kind: r.type,
    score: scoreRecord(r, text),
  }));
}

export function createMemoryManager(
  options: MemoryManagerOptions = {},
): MemoryManager {
  return new MemoryManager(options);
}

export function createDefaultMemoryManager(): MemoryManager {
  const registry = getDefaultMemoryProviderRegistry();
  registerBuiltinMemoryProviders(registry);
  return new MemoryManager({ registry, skipBuiltins: true });
}
