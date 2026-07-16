/**
 * Speech Model Manager — manage STT/TTS models like language models.
 */
import type { ModelRegistry } from "../model-registry/registry.js";
import type {
  RegisterModelInput,
  RegisteredModel,
} from "../model-registry/types.js";
import {
  modalityFromRegistered,
  scanSpeechModels,
  speechMetadataFromFile,
} from "./discover.js";
import {
  ensureSpeechStructure,
  isSpeechStructureReady,
  listSpeechFiles,
  type EnsureSpeechStructureResult,
} from "./storage.js";
import type {
  SpeechFileEntry,
  SpeechModality,
  SpeechModelInfo,
  SpeechModelMetadata,
} from "./types.js";

export interface SpeechModelManagerOptions {
  modelsDir: string;
  registry: ModelRegistry;
  defaultProvider?: string;
}

function toSpeechInfo(model: RegisteredModel): SpeechModelInfo | undefined {
  const modality = modalityFromRegistered(
    model.capabilities,
    model.requirements as Record<string, unknown>,
  );
  if (!modality) {
    return undefined;
  }
  const req = model.requirements as Record<string, unknown>;
  const languages = Array.isArray(req.speechLanguages)
    ? (req.speechLanguages as string[])
    : speechMetadataFromFile({
        id: model.id,
        modality,
        format:
          (req.speechFormat as SpeechModelMetadata["format"]) ?? "unknown",
      }).languages;

  const metadata: SpeechModelMetadata = {
    modality,
    languages,
    sampleRateHz:
      typeof req.sampleRateHz === "number" ? req.sampleRateHz : undefined,
    format:
      (req.speechFormat as SpeechModelMetadata["format"]) ??
      (model.format === "gguf" || model.format === "onnx"
        ? model.format
        : "unknown"),
    voiceId: typeof req.voiceId === "string" ? req.voiceId : undefined,
    notes: typeof req.notes === "string" ? req.notes : undefined,
  };

  return {
    id: model.id,
    name: model.name,
    modality,
    format: metadata.format,
    provider: model.provider,
    status: model.status,
    path: model.location,
    sizeBytes: model.sizeBytes,
    metadata,
  };
}

/**
 * Facade for speech model storage + registry (Architecture/25).
 */
export class SpeechModelManager {
  private readonly modelsDir: string;
  private readonly registry: ModelRegistry;
  private readonly defaultProvider: string;

  constructor(options: SpeechModelManagerOptions) {
    this.modelsDir = options.modelsDir;
    this.registry = options.registry;
    this.defaultProvider = options.defaultProvider ?? "speech-local";
  }

  ensureStructure(): EnsureSpeechStructureResult {
    return ensureSpeechStructure(this.modelsDir);
  }

  isStructureReady(): boolean {
    return isSpeechStructureReady(this.modelsDir);
  }

  listFiles(): SpeechFileEntry[] {
    return listSpeechFiles(this.modelsDir);
  }

  /**
   * Scan speech dirs and upsert into the shared model registry.
   */
  syncFromDisk(): number {
    this.ensureStructure();
    const discovered = scanSpeechModels({
      modelsDir: this.modelsDir,
      provider: this.defaultProvider,
    });
    for (const model of discovered) {
      this.registry.register(model);
    }
    return discovered.length;
  }

  register(input: RegisterModelInput): RegisteredModel {
    const modality =
      modalityFromRegistered(input.capabilities ?? [], input.requirements) ??
      "stt";
    const capabilities = [
      ...(input.capabilities ?? []),
      "speech",
      "local",
      modality,
    ];
    const unique = [...new Set(capabilities)];
    return this.registry.register({
      ...input,
      capabilities: unique,
      requirements: {
        speechModality: modality,
        ...input.requirements,
      },
      provider: input.provider ?? this.defaultProvider,
    });
  }

  get(id: string): SpeechModelInfo | undefined {
    const model = this.registry.get(id);
    return model ? toSpeechInfo(model) : undefined;
  }

  list(filter?: { modality?: SpeechModality }): SpeechModelInfo[] {
    const all = this.registry.list({ capability: "speech" });
    const mapped = all
      .map(toSpeechInfo)
      .filter((m): m is SpeechModelInfo => Boolean(m));
    if (!filter?.modality) {
      return mapped;
    }
    return mapped.filter((m) => m.modality === filter.modality);
  }

  remove(id: string): boolean {
    return this.registry.remove(id);
  }
}

export function createSpeechModelManager(
  options: SpeechModelManagerOptions,
): SpeechModelManager {
  return new SpeechModelManager(options);
}
