import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "./types.js";

/** Where a provider runs relative to the user's machine. */
export type ProviderKind = "local" | "cloud";

/**
 * Optional descriptor for listing / gating providers without coupling to
 * engine internals (Architecture/09 technology independence).
 */
export interface ProviderDescriptor {
  kind: ProviderKind;
  /** True when the provider needs non-loopback network access. */
  requiresNetwork: boolean;
  /** Human-readable label for CLI / UI. */
  label: string;
  notes?: string;
}

/**
 * Pluggable inference backend (Architecture/09 / technology independence).
 * Core and CLI depend on this port — never on llama.cpp internals.
 */
export interface InferenceProvider {
  readonly id: string;
  /** Optional metadata; existing implementers may omit. */
  readonly meta?: ProviderDescriptor;

  health(): Promise<RuntimeHealth>;

  listModels(): Promise<ModelInfo[]>;

  load(modelId: string): Promise<ModelInfo>;

  unload(): Promise<void>;

  generate(req: GenerateRequest): Promise<GenerateResult>;

  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
}
