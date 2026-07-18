/**
 * Sync DEK load/create for CLI memory encryption (ADR-0056).
 * Persists beside the SQLite file until OS keychain adapters land.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  generateAesGcmKey,
  keyFromBase64,
  keyToBase64,
} from "@atlas-ai/security";
import {
  createStaticDekProvider,
  type MemoryDekProvider,
} from "@atlas-ai/memory";

export function createCliMemoryDek(databasePath: string): MemoryDekProvider {
  if (databasePath === ":memory:") {
    return createStaticDekProvider(generateAesGcmKey());
  }
  const dir = dirname(databasePath);
  const dekPath = join(dir, "memory.dek");
  if (existsSync(dekPath)) {
    const encoded = readFileSync(dekPath, "utf8").trim();
    return createStaticDekProvider(keyFromBase64(encoded));
  }
  mkdirSync(dir, { recursive: true });
  const key = generateAesGcmKey();
  writeFileSync(dekPath, `${keyToBase64(key)}\n`, { mode: 0o600 });
  return createStaticDekProvider(key);
}
