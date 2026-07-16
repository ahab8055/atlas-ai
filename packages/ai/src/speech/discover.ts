/**
 * Discover speech weights as registry register inputs.
 */
import type { RegisterModelInput } from "../model-registry/types.js";
import { listSpeechFiles } from "./storage.js";
import type { SpeechModality, SpeechModelMetadata } from "./types.js";

export interface ScanSpeechModelsOptions {
  modelsDir: string;
  provider?: string;
  defaultLanguages?: string[];
}

function inferLanguages(id: string): string[] {
  const lower = id.toLowerCase();
  if (/multilingual|multi[-_]?lang/.test(lower)) {
    return ["multilingual"];
  }
  const hit =
    /(?:^|[._-])(en|es|fr|de|it|pt|zh|ja|ko|ar|hi|ru)(?:[._-]|$)/i.exec(id);
  if (hit?.[1]) {
    return [hit[1].toLowerCase()];
  }
  return ["en"];
}

function inferVoiceId(
  id: string,
  modality: SpeechModality,
): string | undefined {
  if (modality !== "tts") {
    return undefined;
  }
  const leaf = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return leaf;
}

/**
 * Build SpeechModelMetadata from a discovered file id/path.
 */
export function speechMetadataFromFile(input: {
  id: string;
  modality: SpeechModality;
  format: SpeechModelMetadata["format"];
  sampleRateHz?: number;
}): SpeechModelMetadata {
  return {
    modality: input.modality,
    languages: inferLanguages(input.id),
    sampleRateHz:
      input.sampleRateHz ?? (input.modality === "tts" ? 22050 : 16000),
    format: input.format,
    voiceId: inferVoiceId(input.id, input.modality),
    channels: 1,
    notes:
      input.modality === "stt"
        ? "Speech-to-text weights (Architecture/08 STT prep)"
        : "Text-to-speech weights (Architecture/08 TTS prep)",
  };
}

/**
 * Scan models/speech/{stt,tts} for registry registration.
 */
export function scanSpeechModels(
  options: ScanSpeechModelsOptions,
): RegisterModelInput[] {
  const provider = options.provider ?? "speech-local";
  const files = listSpeechFiles(options.modelsDir);

  return files.map((file) => {
    const meta = speechMetadataFromFile({
      id: file.id,
      modality: file.modality,
      format: file.format,
    });
    const capabilities = ["speech", "local", file.modality];
    return {
      id: file.id,
      name: file.id,
      provider,
      version: "1.0.0",
      format:
        file.format === "bin" || file.format === "ggml"
          ? "unknown"
          : file.format,
      sizeBytes: file.sizeBytes,
      capabilities,
      requirements: {
        acceleration: "cpu" as const,
        speechModality: file.modality,
        speechLanguages: meta.languages,
        sampleRateHz: meta.sampleRateHz,
        speechFormat: file.format,
        ...(meta.voiceId ? { voiceId: meta.voiceId } : {}),
        notes: meta.notes,
      },
      location: file.path,
      status: file.valid ? ("available" as const) : ("error" as const),
    };
  });
}

export function modalityFromRegistered(
  capabilities: string[],
  requirements?: Record<string, unknown>,
): SpeechModality | undefined {
  if (
    requirements?.speechModality === "stt" ||
    requirements?.speechModality === "tts"
  ) {
    return requirements.speechModality;
  }
  if (capabilities.includes("tts")) {
    return "tts";
  }
  if (capabilities.includes("stt") || capabilities.includes("speech")) {
    return "stt";
  }
  return undefined;
}
