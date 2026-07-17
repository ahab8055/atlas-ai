/**
 * Register built-in in-memory providers — one isolated store per MemoryType.
 */
import type { MemoryProvider } from "../provider.js";
import type { MemoryProviderRegistry } from "../registry.js";
import {
  InMemoryEpisodicMemoryProvider,
  InMemoryProceduralMemoryProvider,
  InMemorySemanticMemoryProvider,
  InMemoryWorkingMemoryProvider,
} from "./in-memory.js";

export interface RegisterBuiltinMemoryProvidersOptions {
  /** When set, use these instead of constructing builtins. */
  providers?: MemoryProvider[];
}

export function registerBuiltinMemoryProviders(
  registry: MemoryProviderRegistry,
  options: RegisterBuiltinMemoryProvidersOptions = {},
): MemoryProvider[] {
  const builtins: MemoryProvider[] = options.providers ?? [
    new InMemoryWorkingMemoryProvider(),
    new InMemoryEpisodicMemoryProvider(),
    new InMemorySemanticMemoryProvider(),
    new InMemoryProceduralMemoryProvider(),
  ];

  for (const provider of builtins) {
    registry.register(provider, { replace: true });
  }
  return builtins;
}
