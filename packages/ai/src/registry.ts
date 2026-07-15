import type { InferenceProvider } from "./provider.js";
import { AiRuntimeError } from "./errors.js";

/**
 * Registry of inference backends — supports multiple AI runtimes over time.
 */
export class InferenceProviderRegistry {
  private readonly providers = new Map<string, InferenceProvider>();

  register(
    provider: InferenceProvider,
    options: { replace?: boolean } = {},
  ): void {
    if (this.providers.has(provider.id) && !options.replace) {
      throw new AiRuntimeError(
        `Inference provider already registered: ${provider.id}`,
        { code: "provider_exists", provider: provider.id },
      );
    }
    this.providers.set(provider.id, provider);
  }

  get(id: string): InferenceProvider | undefined {
    return this.providers.get(id);
  }

  require(id: string): InferenceProvider {
    const provider = this.get(id);
    if (!provider) {
      throw AiRuntimeError.notFound(id);
    }
    return provider;
  }

  list(): InferenceProvider[] {
    return [...this.providers.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }

  ids(): string[] {
    return this.list().map((p) => p.id);
  }
}

let defaultRegistry: InferenceProviderRegistry | undefined;

export function getDefaultProviderRegistry(): InferenceProviderRegistry {
  defaultRegistry ??= new InferenceProviderRegistry();
  return defaultRegistry;
}

export function setDefaultProviderRegistry(
  registry: InferenceProviderRegistry,
): void {
  defaultRegistry = registry;
}
