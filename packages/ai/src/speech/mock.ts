/**
 * Offline mock STT/TTS providers for wiring tests (no real audio engines).
 */
import { AiRuntimeError } from "../errors.js";
import type {
  SpeechToTextProvider,
  TextToSpeechProvider,
  SpeechProviderHealth,
} from "./provider.js";
import type {
  AudioInput,
  AudioOutput,
  SpeechModelInfo,
  SynthesizeInput,
  TranscriptResult,
} from "./types.js";

function mockSttModel(id: string): SpeechModelInfo {
  return {
    id,
    name: id,
    modality: "stt",
    format: "unknown",
    provider: "mock-stt",
    status: "available",
    metadata: {
      modality: "stt",
      languages: ["en"],
      sampleRateHz: 16000,
      format: "unknown",
      channels: 1,
      notes: "Mock STT — foundation only",
    },
  };
}

function mockTtsModel(id: string): SpeechModelInfo {
  return {
    id,
    name: id,
    modality: "tts",
    format: "unknown",
    provider: "mock-tts",
    status: "available",
    metadata: {
      modality: "tts",
      languages: ["en"],
      sampleRateHz: 22050,
      format: "unknown",
      voiceId: "mock-voice",
      channels: 1,
      notes: "Mock TTS — foundation only",
    },
  };
}

/** Minimal silent WAV header (44 bytes) + no samples — plumbing only. */
function silentWavHeader(sampleRateHz: number): Uint8Array {
  const buf = new Uint8Array(44);
  const view = new DataView(buf.buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      buf[offset + i] = s.charCodeAt(i);
    }
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, 0, true);
  return buf;
}

export interface MockSpeechToTextOptions {
  models?: SpeechModelInfo[];
  defaultModelId?: string;
  transcript?: string;
}

export class MockSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "mock-stt";
  readonly modality = "stt" as const;

  private readonly models: SpeechModelInfo[];
  private readonly defaultModelId: string;
  private readonly transcript: string;
  private active?: SpeechModelInfo;

  constructor(options: MockSpeechToTextOptions = {}) {
    this.defaultModelId = options.defaultModelId ?? "mock-whisper";
    this.transcript = options.transcript ?? "mock transcript";
    this.models = options.models ?? [mockSttModel(this.defaultModelId)];
  }

  async health(): Promise<SpeechProviderHealth> {
    return {
      ok: true,
      provider: this.id,
      modality: "stt",
      message: "Mock STT ready (offline foundation)",
      activeModelId: this.active?.id,
      checkedAt: new Date().toISOString(),
    };
  }

  async listModels(): Promise<SpeechModelInfo[]> {
    return this.models.map((m) => ({
      ...m,
      metadata: { ...m.metadata, languages: [...m.metadata.languages] },
    }));
  }

  async load(modelId: string): Promise<SpeechModelInfo> {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) {
      throw new AiRuntimeError(`Unknown STT model: ${modelId}`, {
        code: "model_not_found",
        provider: this.id,
      });
    }
    this.active = { ...model, status: "loaded" };
    return { ...this.active, metadata: { ...this.active.metadata } };
  }

  async unload(): Promise<void> {
    this.active = undefined;
  }

  async transcribe(
    input: AudioInput,
    options?: { modelId?: string; language?: string },
  ): Promise<TranscriptResult> {
    const started = Date.now();
    const modelId = options?.modelId ?? this.active?.id ?? this.defaultModelId;
    await this.load(modelId);
    const empty = input.data.length === 0;
    return {
      text: empty ? "" : this.transcript,
      language: options?.language ?? "en",
      confidence: empty ? 0 : 0.5,
      modelId,
      provider: this.id,
      durationMs: Date.now() - started,
    };
  }
}

export interface MockTextToSpeechOptions {
  models?: SpeechModelInfo[];
  defaultModelId?: string;
  sampleRateHz?: number;
}

export class MockTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "mock-tts";
  readonly modality = "tts" as const;

  private readonly models: SpeechModelInfo[];
  private readonly defaultModelId: string;
  private readonly sampleRateHz: number;
  private active?: SpeechModelInfo;

  constructor(options: MockTextToSpeechOptions = {}) {
    this.defaultModelId = options.defaultModelId ?? "mock-piper";
    this.sampleRateHz = options.sampleRateHz ?? 22050;
    this.models = options.models ?? [mockTtsModel(this.defaultModelId)];
  }

  async health(): Promise<SpeechProviderHealth> {
    return {
      ok: true,
      provider: this.id,
      modality: "tts",
      message: "Mock TTS ready (offline foundation)",
      activeModelId: this.active?.id,
      checkedAt: new Date().toISOString(),
    };
  }

  async listModels(): Promise<SpeechModelInfo[]> {
    return this.models.map((m) => ({
      ...m,
      metadata: { ...m.metadata, languages: [...m.metadata.languages] },
    }));
  }

  async load(modelId: string): Promise<SpeechModelInfo> {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) {
      throw new AiRuntimeError(`Unknown TTS model: ${modelId}`, {
        code: "model_not_found",
        provider: this.id,
      });
    }
    this.active = { ...model, status: "loaded" };
    return { ...this.active, metadata: { ...this.active.metadata } };
  }

  async unload(): Promise<void> {
    this.active = undefined;
  }

  async synthesize(input: SynthesizeInput): Promise<AudioOutput> {
    const started = Date.now();
    const modelId = input.modelId ?? this.active?.id ?? this.defaultModelId;
    await this.load(modelId);
    const data =
      input.text.trim().length === 0
        ? new Uint8Array(0)
        : silentWavHeader(this.sampleRateHz);
    return {
      data,
      mimeType: "audio/wav",
      sampleRateHz: this.sampleRateHz,
      channels: 1,
      modelId,
      provider: this.id,
      durationMs: Date.now() - started,
    };
  }
}
