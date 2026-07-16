/**
 * Speech model types (Architecture/25 Speech Model Management,
 * Architecture/08 Voice System — integration prep).
 */
import type { ModelFormat, ModelStatus } from "../types.js";

/** STT vs TTS modality under models/speech/. */
export type SpeechModality = "stt" | "tts";

/** Formats commonly used by Whisper / Piper / ggml speech stacks. */
export type SpeechModelFormat = ModelFormat | "ggml" | "bin";

export interface SpeechModelMetadata {
  modality: SpeechModality;
  /** BCP-47 / ISO language tags when known (e.g. en, multilingual). */
  languages: string[];
  /** Preferred / native sample rate in Hz. */
  sampleRateHz?: number;
  format: SpeechModelFormat;
  /** TTS voice identifier when applicable. */
  voiceId?: string;
  /** Audio channel count when known. */
  channels?: number;
  notes?: string;
}

/** Catalog entry for a speech model (parallel to chat ModelInfo). */
export interface SpeechModelInfo {
  id: string;
  name: string;
  modality: SpeechModality;
  format: SpeechModelFormat;
  provider: string;
  status: ModelStatus;
  path?: string;
  sizeBytes?: number;
  metadata: SpeechModelMetadata;
}

/** Stub audio input for STT — no microphone capture in this foundation. */
export interface AudioInput {
  data: Uint8Array;
  mimeType: string;
  sampleRateHz?: number;
  channels?: number;
  /** Optional duration hint in milliseconds. */
  durationMs?: number;
}

/** Stub audio output for TTS — consume spokenText later (Architecture/08). */
export interface AudioOutput {
  data: Uint8Array;
  mimeType: string;
  sampleRateHz?: number;
  channels?: number;
  modelId: string;
  provider: string;
  durationMs: number;
}

export interface TranscriptResult {
  text: string;
  language?: string;
  confidence?: number;
  modelId: string;
  provider: string;
  durationMs: number;
}

export interface SynthesizeInput {
  /** Prefer ResponseGenerator `spokenText` when wiring voice. */
  text: string;
  modelId?: string;
  voiceId?: string;
  language?: string;
}

export interface SpeechFileEntry {
  id: string;
  path: string;
  relativePath: string;
  modality: SpeechModality;
  format: SpeechModelFormat;
  sizeBytes: number;
  /** True when GGUF magic validated (or non-GGUF size-only OK). */
  valid: boolean;
  reason?: string;
}

export const SPEECH_MODALITIES: readonly SpeechModality[] = ["stt", "tts"];

export const SPEECH_FILE_EXTENSIONS = [
  ".gguf",
  ".onnx",
  ".ggml",
  ".bin",
] as const;
