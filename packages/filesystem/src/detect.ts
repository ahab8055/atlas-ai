/**
 * Content-aware file type detection (ADR-0089).
 * Extension + magic-byte signatures + light text heuristics. No libmagic.
 */

import { formatFromExtension, isUnsupportedBinaryFormat } from "./format.js";
import { mimeFromExtension } from "./mime.js";
import type {
  DetectionConfidence,
  DetectionSource,
  FileFormat,
} from "./types.js";

export const DEFAULT_DETECT_BYTES = 4096;

export type { DetectionConfidence, DetectionSource };

export interface DetectFileTypeOptions {
  extension?: string;
  /** Head window (caller should cap ≤ DEFAULT_DETECT_BYTES). */
  bytes?: Uint8Array;
  /** Optional decoded sample for text heuristics. */
  sampleText?: string;
}

export interface DetectedFileType {
  mimeType: string;
  format: FileFormat;
  extensionMime: string;
  extensionFormat: FileFormat;
  source: DetectionSource;
  confidence: DetectionConfidence;
  signatureId?: string;
  extensionMismatch: boolean;
}

export interface SignatureMatch {
  id: string;
  mimeType: string;
  format: FileFormat;
}

const MISMATCH_FRIENDLY = new Set<FileFormat>(["unknown", "text", "markdown"]);

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}

function asciiPrefix(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (bytes[i] !== text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

/**
 * Match known binary magic prefixes. Returns the first match.
 */
export function sniffSignature(bytes: Uint8Array): SignatureMatch | undefined {
  if (bytes.length === 0) {
    return undefined;
  }
  if (
    startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { id: "png", mimeType: "image/png", format: "binary" };
  }
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { id: "jpeg", mimeType: "image/jpeg", format: "binary" };
  }
  if (
    startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { id: "gif", mimeType: "image/gif", format: "binary" };
  }
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { id: "webp", mimeType: "image/webp", format: "binary" };
  }
  if (asciiPrefix(bytes, "%PDF")) {
    return { id: "pdf", mimeType: "application/pdf", format: "binary" };
  }
  if (
    startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return { id: "zip", mimeType: "application/zip", format: "binary" };
  }
  if (startsWithBytes(bytes, [0x1f, 0x8b])) {
    return { id: "gzip", mimeType: "application/gzip", format: "binary" };
  }
  return undefined;
}

function looksLikeJson(sample: string): boolean {
  const t = sample.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) {
    return false;
  }
  try {
    JSON.parse(t);
    return true;
  } catch {
    // Truncated samples: still treat leading { / [ as medium JSON hint
    return t.length >= 2 && (t[0] === "{" || t[0] === "[");
  }
}

function looksLikeYaml(sample: string): boolean {
  const t = sample.trim();
  if (!t) {
    return false;
  }
  if (t.startsWith("---")) {
    return true;
  }
  const lines = t
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) {
    return false;
  }
  const keyLine = /^[A-Za-z_][\w.-]*\s*:\s*.+$/;
  let hits = 0;
  for (const line of lines.slice(0, 8)) {
    if (
      keyLine.test(line) &&
      !line.includes("{") &&
      !line.trim().startsWith("-")
    ) {
      hits++;
    }
  }
  return hits >= 2;
}

function looksLikeCsv(sample: string): boolean {
  const lines = sample
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 5);
  if (lines.length < 2) {
    return false;
  }
  const counts = lines.map((l) => (l.match(/,/g) ?? []).length);
  const first = counts[0] ?? 0;
  if (first < 1) {
    return false;
  }
  return counts.every((c) => c === first);
}

function looksLikeXml(sample: string): boolean {
  const t = sample.trimStart().toLowerCase();
  return (
    t.startsWith("<?xml") ||
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    (t.startsWith("<") && t.includes("</"))
  );
}

interface ContentHint {
  format: FileFormat;
  mimeType: string;
  confidence: DetectionConfidence;
}

function sniffTextContent(sampleText: string): ContentHint | undefined {
  const sample = sampleText.slice(0, DEFAULT_DETECT_BYTES);
  if (!sample.trim()) {
    return undefined;
  }
  if (looksLikeJson(sample)) {
    return {
      format: "json",
      mimeType: "application/json",
      confidence:
        sample.trim().endsWith("}") || sample.trim().endsWith("]")
          ? "high"
          : "medium",
    };
  }
  if (looksLikeXml(sample)) {
    return {
      format: "xml",
      mimeType: "application/xml",
      confidence: "medium",
    };
  }
  if (looksLikeYaml(sample)) {
    return {
      format: "yaml",
      mimeType: "application/yaml",
      confidence: "medium",
    };
  }
  if (looksLikeCsv(sample)) {
    return {
      format: "csv",
      mimeType: "text/csv",
      confidence: "medium",
    };
  }
  return undefined;
}

/**
 * Merge extension, magic-byte signature, and optional text heuristics.
 */
export function detectFileType(
  opts: DetectFileTypeOptions = {},
): DetectedFileType {
  const extension = opts.extension ?? "";
  const extensionMime = mimeFromExtension(extension);
  const extensionFormat = formatFromExtension(extension);

  const bytes = opts.bytes;
  const signature =
    bytes && bytes.length > 0 ? sniffSignature(bytes) : undefined;

  if (signature) {
    const extensionMismatch =
      (extensionFormat !== "unknown" && extensionFormat !== signature.format) ||
      (Boolean(extension) &&
        extensionMime !== "application/octet-stream" &&
        extensionMime !== signature.mimeType);
    const aligned =
      extensionFormat === signature.format &&
      (extensionMime === signature.mimeType ||
        extensionMime === "application/octet-stream");
    return {
      mimeType: signature.mimeType,
      format: signature.format,
      extensionMime,
      extensionFormat,
      source: aligned ? "mixed" : "signature",
      confidence: "high",
      signatureId: signature.id,
      extensionMismatch,
    };
  }

  const sampleText =
    opts.sampleText ??
    (bytes && bytes.length > 0
      ? new TextDecoder("utf-8", { fatal: false }).decode(bytes)
      : undefined);

  const contentHint =
    sampleText !== undefined ? sniffTextContent(sampleText) : undefined;

  if (contentHint) {
    const canOverride =
      MISMATCH_FRIENDLY.has(extensionFormat) ||
      !extension ||
      contentHint.confidence === "high" ||
      extensionFormat === contentHint.format;

    // Never upgrade a confident binary extension to text without a signature.
    if (isUnsupportedBinaryFormat(extensionFormat) && !signature) {
      return {
        mimeType: extensionMime,
        format: extensionFormat,
        extensionMime,
        extensionFormat,
        source: "extension",
        confidence: "high",
        extensionMismatch: false,
      };
    }

    if (canOverride) {
      const extensionMismatch =
        extensionFormat !== "unknown" && extensionFormat !== contentHint.format;
      return {
        mimeType: contentHint.mimeType,
        format: contentHint.format,
        extensionMime,
        extensionFormat,
        source: extensionMismatch ? "content" : "mixed",
        confidence: contentHint.confidence,
        extensionMismatch,
      };
    }
  }

  return {
    mimeType: extensionMime,
    format:
      extensionFormat === "unknown" && !extension ? "unknown" : extensionFormat,
    extensionMime,
    extensionFormat,
    source: "extension",
    confidence: extension ? "medium" : "low",
    extensionMismatch: false,
  };
}
