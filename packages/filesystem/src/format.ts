/**
 * Extension → logical file format for the reading engine (ADR-0078).
 */

import { mimeFromExtension } from "./mime.js";
import type { FileFormat } from "./types.js";

const SOURCE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".html",
  ".htm",
  ".sh",
  ".py",
  ".rs",
  ".go",
  ".toml",
]);

const BINARY_MIME_PREFIXES = ["image/", "audio/", "video/"];

const BINARY_MIME_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/gzip",
]);

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".zip",
  ".gz",
]);

export function formatFromExtension(extension: string): FileFormat {
  const ext = extension.startsWith(".")
    ? extension.toLowerCase()
    : extension
      ? `.${extension.toLowerCase()}`
      : "";
  if (!ext) {
    return "unknown";
  }
  if (BINARY_EXTS.has(ext)) {
    return "binary";
  }
  if (ext === ".json") {
    return "json";
  }
  if (ext === ".yaml" || ext === ".yml") {
    return "yaml";
  }
  if (ext === ".csv") {
    return "csv";
  }
  if (ext === ".md" || ext === ".markdown") {
    return "markdown";
  }
  if (ext === ".xml" || ext === ".svg") {
    return "xml";
  }
  if (ext === ".txt") {
    return "text";
  }
  if (SOURCE_EXTS.has(ext)) {
    return "source";
  }
  const mime = mimeFromExtension(ext);
  if (isBinaryMime(mime)) {
    return "binary";
  }
  if (mime.startsWith("text/")) {
    return "text";
  }
  return "unknown";
}

export function isBinaryMime(mimeType: string): boolean {
  if (BINARY_MIME_EXACT.has(mimeType)) {
    return true;
  }
  return BINARY_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
}

export function isUnsupportedBinaryFormat(format: FileFormat): boolean {
  return format === "binary";
}
