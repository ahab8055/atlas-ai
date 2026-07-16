/**
 * Safe file persistence for inference settings (non-secret JSON under dataDir).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { emptyStoredSettings, sanitizeStoredSettings } from "./validate.js";
import type { StoredInferenceSettings } from "./types.js";

export const INFERENCE_SETTINGS_FILENAME = "inference-settings.json";

export function inferenceSettingsPath(dataDir: string): string {
  return join(dataDir, INFERENCE_SETTINGS_FILENAME);
}

export interface InferenceSettingsStore {
  load(): StoredInferenceSettings;
  save(settings: StoredInferenceSettings): void;
  path: string;
}

/**
 * Atomic JSON store — write temp file then rename.
 * Contents are validated on load and save (no secrets allowed).
 */
export function createFileInferenceSettingsStore(
  dataDir: string,
): InferenceSettingsStore {
  const path = inferenceSettingsPath(dataDir);

  return {
    path,
    load(): StoredInferenceSettings {
      try {
        const raw = readFileSync(path, "utf8");
        return sanitizeStoredSettings(JSON.parse(raw) as unknown);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined;
        if (code === "ENOENT") {
          return emptyStoredSettings();
        }
        // Corrupt file → empty rather than crash
        return emptyStoredSettings();
      }
    },
    save(settings: StoredInferenceSettings): void {
      const safe = sanitizeStoredSettings({
        ...settings,
        updatedAt: new Date().toISOString(),
      });
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(safe, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      renameSync(tmp, path);
    },
  };
}

export function createMemoryInferenceSettingsStore(
  initial?: StoredInferenceSettings,
): InferenceSettingsStore {
  let current = sanitizeStoredSettings(initial ?? emptyStoredSettings());
  return {
    path: ":memory:",
    load(): StoredInferenceSettings {
      return sanitizeStoredSettings(current);
    },
    save(settings: StoredInferenceSettings): void {
      current = sanitizeStoredSettings({
        ...settings,
        updatedAt: new Date().toISOString(),
      });
    },
  };
}
