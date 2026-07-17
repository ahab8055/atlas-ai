/**
 * Register persistent (SQLite) long-term providers; keep working in-memory.
 */
import type { MemoriesRepository } from "@atlas-ai/database";

import type { MemoryProvider } from "../provider.js";
import type { MemoryProviderRegistry } from "../registry.js";
import { InMemoryWorkingMemoryProvider } from "./in-memory.js";
import { SqliteMemoryProvider } from "./sqlite.js";

export function registerPersistentMemoryProviders(
  registry: MemoryProviderRegistry,
  repo: MemoriesRepository,
): MemoryProvider[] {
  const providers: MemoryProvider[] = [
    new InMemoryWorkingMemoryProvider(),
    new SqliteMemoryProvider("episodic", repo),
    new SqliteMemoryProvider("semantic", repo),
    new SqliteMemoryProvider("procedural", repo),
  ];
  for (const provider of providers) {
    registry.register(provider, { replace: true });
  }
  return providers;
}
