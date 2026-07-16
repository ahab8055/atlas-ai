/**
 * STT / TTS provider ports — Architecture/08 integration prep.
 * Independent from chat InferenceProvider (Architecture/25).
 */
import type {
  AudioInput,
  AudioOutput,
  SpeechModelInfo,
  SynthesizeInput,
  TranscriptResult,
} from "./types.js";

export interface SpeechProviderHealth {
  ok: boolean;
  provider: string;
  message: string;
  modality: "stt" | "tts";
  activeModelId?: string;
  checkedAt: string;
}

export interface SpeechToTextProvider {
  readonly id: string;
  readonly modality: "stt";

  health(): Promise<SpeechProviderHealth>;

  listModels(): Promise<SpeechModelInfo[]>;

  load(modelId: string): Promise<SpeechModelInfo>;

  unload(): Promise<void>;

  /** Transcribe audio bytes → text (no mic capture in this foundation). */
  transcribe(
    input: AudioInput,
    options?: { modelId?: string; language?: string },
  ): Promise<TranscriptResult>;
}

export interface TextToSpeechProvider {
  readonly id: string;
  readonly modality: "tts";

  health(): Promise<SpeechProviderHealth>;

  listModels(): Promise<SpeechModelInfo[]>;

  load(modelId: string): Promise<SpeechModelInfo>;

  unload(): Promise<void>;

  /**
   * Synthesize speakable text → audio bytes.
   * Prefer ResponseGenerator `spokenText` when wiring Architecture/08.
   */
  synthesize(input: SynthesizeInput): Promise<AudioOutput>;
}
