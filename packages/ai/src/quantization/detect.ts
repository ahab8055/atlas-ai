/**
 * Detect GGUF quantization level from filenames / model ids.
 */
import type {
  QuantizationFamily,
  QuantizationInfo,
  QuantizationLevel,
} from "./types.js";

/** Ordered patterns — more specific first (Q4_K_M before Q4). */
const QUANT_PATTERNS: Array<{
  re: RegExp;
  level: QuantizationLevel;
  family: QuantizationFamily;
  approxBits: number;
}> = [
  // IQ family
  {
    re: /(?:^|[._-])IQ1_S(?:[._-]|$)/i,
    level: "IQ1_S",
    family: "ultra_low",
    approxBits: 1.5,
  },
  {
    re: /(?:^|[._-])IQ1_M(?:[._-]|$)/i,
    level: "IQ1_M",
    family: "ultra_low",
    approxBits: 1.75,
  },
  {
    re: /(?:^|[._-])IQ2_XXS(?:[._-]|$)/i,
    level: "IQ2_XXS",
    family: "ultra_low",
    approxBits: 2.1,
  },
  {
    re: /(?:^|[._-])IQ2_XS(?:[._-]|$)/i,
    level: "IQ2_XS",
    family: "ultra_low",
    approxBits: 2.3,
  },
  {
    re: /(?:^|[._-])IQ2_S(?:[._-]|$)/i,
    level: "IQ2_S",
    family: "ultra_low",
    approxBits: 2.5,
  },
  {
    re: /(?:^|[._-])IQ2_M(?:[._-]|$)/i,
    level: "IQ2_M",
    family: "ultra_low",
    approxBits: 2.7,
  },
  {
    re: /(?:^|[._-])IQ3_XXS(?:[._-]|$)/i,
    level: "IQ3_XXS",
    family: "low",
    approxBits: 3.1,
  },
  {
    re: /(?:^|[._-])IQ3_XS(?:[._-]|$)/i,
    level: "IQ3_XS",
    family: "low",
    approxBits: 3.3,
  },
  {
    re: /(?:^|[._-])IQ3_S(?:[._-]|$)/i,
    level: "IQ3_S",
    family: "low",
    approxBits: 3.4,
  },
  {
    re: /(?:^|[._-])IQ3_M(?:[._-]|$)/i,
    level: "IQ3_M",
    family: "low",
    approxBits: 3.7,
  },
  {
    re: /(?:^|[._-])IQ4_NL(?:[._-]|$)/i,
    level: "IQ4_NL",
    family: "medium",
    approxBits: 4.25,
  },
  {
    re: /(?:^|[._-])IQ4_XS(?:[._-]|$)/i,
    level: "IQ4_XS",
    family: "medium",
    approxBits: 4.25,
  },
  // QK variants
  {
    re: /(?:^|[._-])Q2_K(?:[._-]|$)/i,
    level: "Q2_K",
    family: "ultra_low",
    approxBits: 2.5,
  },
  {
    re: /(?:^|[._-])Q3_K_S(?:[._-]|$)/i,
    level: "Q3_K_S",
    family: "low",
    approxBits: 3.4,
  },
  {
    re: /(?:^|[._-])Q3_K_M(?:[._-]|$)/i,
    level: "Q3_K_M",
    family: "low",
    approxBits: 3.7,
  },
  {
    re: /(?:^|[._-])Q3_K_L(?:[._-]|$)/i,
    level: "Q3_K_L",
    family: "low",
    approxBits: 4.0,
  },
  {
    re: /(?:^|[._-])Q3_K(?:[._-]|$)/i,
    level: "Q3_K",
    family: "low",
    approxBits: 3.5,
  },
  {
    re: /(?:^|[._-])Q4_K_S(?:[._-]|$)/i,
    level: "Q4_K_S",
    family: "medium",
    approxBits: 4.4,
  },
  {
    re: /(?:^|[._-])Q4_K_M(?:[._-]|$)/i,
    level: "Q4_K_M",
    family: "medium",
    approxBits: 4.8,
  },
  {
    re: /(?:^|[._-])Q4_K(?:[._-]|$)/i,
    level: "Q4_K",
    family: "medium",
    approxBits: 4.5,
  },
  {
    re: /(?:^|[._-])Q4_0(?:[._-]|$)/i,
    level: "Q4_0",
    family: "medium",
    approxBits: 4.0,
  },
  {
    re: /(?:^|[._-])Q4_1(?:[._-]|$)/i,
    level: "Q4_1",
    family: "medium",
    approxBits: 4.5,
  },
  {
    re: /(?:^|[._-])Q5_K_S(?:[._-]|$)/i,
    level: "Q5_K_S",
    family: "high",
    approxBits: 5.4,
  },
  {
    re: /(?:^|[._-])Q5_K_M(?:[._-]|$)/i,
    level: "Q5_K_M",
    family: "high",
    approxBits: 5.7,
  },
  {
    re: /(?:^|[._-])Q5_K(?:[._-]|$)/i,
    level: "Q5_K",
    family: "high",
    approxBits: 5.5,
  },
  {
    re: /(?:^|[._-])Q5_0(?:[._-]|$)/i,
    level: "Q5_0",
    family: "high",
    approxBits: 5.0,
  },
  {
    re: /(?:^|[._-])Q5_1(?:[._-]|$)/i,
    level: "Q5_1",
    family: "high",
    approxBits: 5.5,
  },
  {
    re: /(?:^|[._-])Q6_K(?:[._-]|$)/i,
    level: "Q6_K",
    family: "high",
    approxBits: 6.5,
  },
  {
    re: /(?:^|[._-])Q8_0(?:[._-]|$)/i,
    level: "Q8_0",
    family: "near_full",
    approxBits: 8.0,
  },
  // Full precision
  {
    re: /(?:^|[._-])(?:FP16|F16)(?:[._-]|$)/i,
    level: "F16",
    family: "full",
    approxBits: 16,
  },
  {
    re: /(?:^|[._-])(?:FP32|F32)(?:[._-]|$)/i,
    level: "F32",
    family: "full",
    approxBits: 32,
  },
  {
    re: /(?:^|[._-])BF16(?:[._-]|$)/i,
    level: "BF16",
    family: "full",
    approxBits: 16,
  },
];

const FAMILY_LABEL: Record<QuantizationFamily, string> = {
  ultra_low: "ultra-low (≈2-bit)",
  low: "low (≈3-bit)",
  medium: "medium (≈4-bit)",
  high: "high (≈5–6-bit)",
  near_full: "near-full (8-bit)",
  full: "full precision",
  unknown: "unknown",
};

/**
 * Detect quantization from a model id, filename, or path.
 */
export function detectQuantization(
  modelIdOrPath: string,
  explicit?: QuantizationLevel,
): QuantizationInfo {
  if (explicit?.trim()) {
    const level = normalizeQuantLevel(explicit);
    const meta = familyForLevel(level);
    return {
      level,
      family: meta.family,
      quantized: meta.family !== "full" && meta.family !== "unknown",
      source: "explicit",
      summary: `${level} (${FAMILY_LABEL[meta.family]})`,
      approxBits: meta.approxBits,
    };
  }

  const name =
    modelIdOrPath.replace(/\\/g, "/").split("/").pop() ?? modelIdOrPath;
  for (const pattern of QUANT_PATTERNS) {
    if (pattern.re.test(name)) {
      return {
        level: pattern.level,
        family: pattern.family,
        quantized: pattern.family !== "full",
        source: "filename",
        summary: `${pattern.level} (${FAMILY_LABEL[pattern.family]})`,
        approxBits: pattern.approxBits,
      };
    }
  }

  // Generic Qn fallback (e.g. "model-q4.gguf")
  const generic = /(?:^|[._-])Q([2-8])(?:[._-]|$)/i.exec(name);
  if (generic?.[1]) {
    const n = Number(generic[1]);
    const level = `Q${n}`;
    const family =
      n <= 2
        ? "ultra_low"
        : n === 3
          ? "low"
          : n === 4
            ? "medium"
            : n <= 6
              ? "high"
              : "near_full";
    return {
      level,
      family,
      quantized: true,
      source: "filename",
      summary: `${level} (${FAMILY_LABEL[family]})`,
      approxBits: n,
    };
  }

  return {
    family: "unknown",
    quantized: false,
    source: "unknown",
    summary: "quantization unknown (no Q*/F16 tag in name)",
  };
}

export function normalizeQuantLevel(raw: string): QuantizationLevel {
  return raw
    .trim()
    .toUpperCase()
    .replace(/FP16/i, "F16")
    .replace(/FP32/i, "F32");
}

export function familyForLevel(level: QuantizationLevel): {
  family: QuantizationFamily;
  approxBits?: number;
} {
  const hit = QUANT_PATTERNS.find(
    (p) => p.level === normalizeQuantLevel(level),
  );
  if (hit) {
    return { family: hit.family, approxBits: hit.approxBits };
  }
  const m = /^Q([2-8])/i.exec(level);
  if (m?.[1]) {
    const n = Number(m[1]);
    return {
      family:
        n <= 2
          ? "ultra_low"
          : n === 3
            ? "low"
            : n === 4
              ? "medium"
              : n <= 6
                ? "high"
                : "near_full",
      approxBits: n,
    };
  }
  if (/^F(16|32)|BF16$/i.test(level)) {
    return { family: "full", approxBits: /32/.test(level) ? 32 : 16 };
  }
  return { family: "unknown" };
}

export function isQuantizedGguf(modelIdOrPath: string): boolean {
  return detectQuantization(modelIdOrPath).quantized;
}

export function formatQuantizationInfo(info: QuantizationInfo): string {
  const lines = [
    `Quantization: ${info.level ?? "(unknown)"}`,
    `Family: ${info.family} (${FAMILY_LABEL[info.family]})`,
    `Quantized: ${info.quantized ? "yes" : "no"}`,
    `Source: ${info.source}`,
    ...(info.approxBits !== undefined
      ? [`Approx bits/weight: ~${info.approxBits}`]
      : []),
    info.summary,
  ];
  return lines.join("\n");
}
