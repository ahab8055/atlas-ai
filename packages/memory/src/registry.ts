/**
 * Registry of memory providers keyed by MemoryType.
 */
import { MemoryError } from "./errors.js";
import type { MemoryProvider } from "./provider.js";
import type { MemoryType } from "./types.js";

export class MemoryProviderRegistry {
  private readonly providers = new Map<MemoryType, MemoryProvider>();

  register(
    provider: MemoryProvider,
    options: { replace?: boolean } = {},
  ): void {
    if (this.providers.has(provider.type) && !options.replace) {
      throw new MemoryError(
        `Memory provider already registered for type: ${provider.type}`,
        { code: "provider_exists", type: provider.type },
      );
    }
    this.providers.set(provider.type, provider);
  }

  get(type: MemoryType): MemoryProvider | undefined {
    return this.providers.get(type);
  }

  require(type: MemoryType): MemoryProvider {
    const provider = this.get(type);
    if (!provider) {
      throw MemoryError.providerNotFound(type);
    }
    return provider;
  }

  types(): MemoryType[] {
    return [...this.providers.keys()].sort((a, b) => a.localeCompare(b));
  }

  all(): MemoryProvider[] {
    return this.types().map((t) => this.providers.get(t)!);
  }
}

let defaultRegistry: MemoryProviderRegistry | undefined;

export function getDefaultMemoryProviderRegistry(): MemoryProviderRegistry {
  defaultRegistry ??= new MemoryProviderRegistry();
  return defaultRegistry;
}

export function setDefaultMemoryProviderRegistry(
  registry: MemoryProviderRegistry,
): void {
  defaultRegistry = registry;
}
