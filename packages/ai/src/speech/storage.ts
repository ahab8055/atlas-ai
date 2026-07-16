/**
 * Speech model storage under models/speech/{stt,tts}/ (Architecture/25).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { validateGgufFile } from "../gguf.js";
import { ensureModelDirectoryStructure } from "../model-storage/layout.js";
import {
  SPEECH_FILE_EXTENSIONS,
  SPEECH_MODALITIES,
  type SpeechFileEntry,
  type SpeechModality,
  type SpeechModelFormat,
} from "./types.js";

export interface EnsureSpeechStructureResult {
  modelsDir: string;
  speechDir: string;
  created: string[];
  existing: string[];
}

export function speechModalityPath(
  modelsDir: string,
  modality: SpeechModality,
): string {
  return path.join(modelsDir, "speech", modality);
}

/**
 * Ensure models/ + category folders, then speech/stt and speech/tts.
 */
export function ensureSpeechStructure(
  modelsDir: string,
): EnsureSpeechStructureResult {
  const base = ensureModelDirectoryStructure(modelsDir);
  const created = [...base.created];
  const existing = [...base.existing];
  const speechDir = path.join(modelsDir, "speech");

  const ensureDir = (dir: string): void => {
    if (existsSync(dir)) {
      if (!existing.includes(dir) && !created.includes(dir)) {
        existing.push(dir);
      }
      return;
    }
    mkdirSync(dir, { recursive: true });
    created.push(dir);
  };

  ensureDir(speechDir);
  for (const modality of SPEECH_MODALITIES) {
    const dir = speechModalityPath(modelsDir, modality);
    const wasMissing = !existsSync(dir);
    ensureDir(dir);
    if (wasMissing || created.includes(dir)) {
      const keep = path.join(dir, ".gitkeep");
      if (!existsSync(keep)) {
        writeFileSync(keep, "");
      }
    }
  }

  return { modelsDir, speechDir, created, existing };
}

export function isSpeechStructureReady(modelsDir: string): boolean {
  if (!existsSync(path.join(modelsDir, "speech"))) {
    return false;
  }
  return SPEECH_MODALITIES.every((m) =>
    existsSync(speechModalityPath(modelsDir, m)),
  );
}

function extensionFormat(ext: string): SpeechModelFormat {
  switch (ext.toLowerCase()) {
    case ".gguf":
      return "gguf";
    case ".onnx":
      return "onnx";
    case ".ggml":
      return "ggml";
    case ".bin":
      return "bin";
    default:
      return "unknown";
  }
}

function isSpeechExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return SPEECH_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * List speech weight files under speech/stt and speech/tts
 * (also flat speech/*.ext treated as stt for legacy drops).
 */
export function listSpeechFiles(modelsDir: string): SpeechFileEntry[] {
  const results: SpeechFileEntry[] = [];
  if (!existsSync(modelsDir)) {
    return results;
  }

  const scanDir = (dir: string, modality: SpeechModality, idPrefix: string) => {
    if (!existsSync(dir)) {
      return;
    }
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) {
        continue;
      }
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (!st.isFile() || !isSpeechExtension(name)) {
        continue;
      }
      const ext = path.extname(name);
      const format = extensionFormat(ext);
      const leaf = name.slice(0, -ext.length) || name;
      const id = `${idPrefix}/${leaf}`;
      const relativePath = path.relative(modelsDir, full);

      if (format === "gguf") {
        const validation = validateGgufFile(full);
        results.push({
          id,
          path: full,
          relativePath,
          modality,
          format,
          sizeBytes: validation.sizeBytes ?? st.size,
          valid: validation.ok,
          reason: validation.reason,
        });
      } else {
        results.push({
          id,
          path: full,
          relativePath,
          modality,
          format,
          sizeBytes: st.size,
          valid: st.size > 0,
          reason: st.size > 0 ? undefined : "empty file",
        });
      }
    }
  };

  for (const modality of SPEECH_MODALITIES) {
    scanDir(
      speechModalityPath(modelsDir, modality),
      modality,
      `speech/${modality}`,
    );
  }

  // Legacy: files directly under speech/ (not stt/tts) → stt
  const speechRoot = path.join(modelsDir, "speech");
  if (existsSync(speechRoot)) {
    for (const name of readdirSync(speechRoot)) {
      if (
        name.startsWith(".") ||
        SPEECH_MODALITIES.includes(name as SpeechModality)
      ) {
        continue;
      }
      const full = path.join(speechRoot, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (!st.isFile() || !isSpeechExtension(name)) {
        continue;
      }
      const ext = path.extname(name);
      const format = extensionFormat(ext);
      const leaf = name.slice(0, -ext.length) || name;
      const id = `speech/stt/${leaf}`;
      if (format === "gguf") {
        const validation = validateGgufFile(full);
        results.push({
          id,
          path: full,
          relativePath: path.relative(modelsDir, full),
          modality: "stt",
          format,
          sizeBytes: validation.sizeBytes ?? st.size,
          valid: validation.ok,
          reason: validation.reason,
        });
      } else {
        results.push({
          id,
          path: full,
          relativePath: path.relative(modelsDir, full),
          modality: "stt",
          format,
          sizeBytes: st.size,
          valid: st.size > 0,
          reason: st.size > 0 ? undefined : "empty file",
        });
      }
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}

export function speechDestinationPath(
  modelsDir: string,
  modality: SpeechModality,
  fileName: string,
): string {
  const leaf = path.basename(fileName);
  return path.join(speechModalityPath(modelsDir, modality), leaf);
}
