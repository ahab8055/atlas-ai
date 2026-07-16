/**
 * GGUF quantization types (Architecture/25 Model Quantization Management).
 */

/** Broad families used for hardware recommendations. */
export type QuantizationFamily =
  "ultra_low" | "low" | "medium" | "high" | "near_full" | "full" | "unknown";

/**
 * Detected / recommended quantization tag (llama.cpp naming).
 * Examples: Q4_K_M, Q5_0, Q8_0, F16, IQ4_NL
 */
export type QuantizationLevel = string;

export interface QuantizationInfo {
  /** Canonical tag when known (uppercase, e.g. Q4_K_M). */
  level?: QuantizationLevel;
  family: QuantizationFamily;
  /** True when weights are quantized (not F16/F32/BF16). */
  quantized: boolean;
  /** Where the level was inferred from. */
  source: "filename" | "explicit" | "unknown";
  /** Human-readable summary. */
  summary: string;
  /** Bits-per-weight hint when known. */
  approxBits?: number;
}

export interface QuantizationTradeoff {
  family: QuantizationFamily;
  /** Example levels in this family. */
  examples: string[];
  sizeVsFp16: string;
  speed: string;
  quality: string;
  bestFor: string;
}

export interface QuantizationRecommendation {
  profileId: string;
  /** Preferred family for this host. */
  preferredFamily: QuantizationFamily;
  /** Concrete levels to prefer (highest first). */
  preferredLevels: QuantizationLevel[];
  /** Acceptable alternate families. */
  acceptableFamilies: QuantizationFamily[];
  reasons: string[];
  tradeoffs: QuantizationTradeoff[];
}
