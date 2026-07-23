/**
 * Format → processing module registry (ADR-0089).
 * Maps detected FileFormat to existing read/index pipelines (no PDF/DOCX extractors).
 */

import type { FileFormat } from "./types.js";

export type FileProcessorId =
  | "read.text"
  | "read.json"
  | "read.yaml"
  | "read.csv"
  | "index.text"
  | "reject.binary";

const INDEXABLE_FORMATS = new Set<FileFormat>([
  "text",
  "markdown",
  "json",
  "yaml",
  "csv",
  "source",
  "xml",
]);

/**
 * Primary read-pipeline processor for a logical format.
 */
export function processorForFormat(format: FileFormat): FileProcessorId {
  switch (format) {
    case "json":
      return "read.json";
    case "yaml":
      return "read.yaml";
    case "csv":
      return "read.csv";
    case "binary":
      return "reject.binary";
    case "text":
    case "markdown":
    case "source":
    case "xml":
    case "unknown":
      return "read.text";
    default:
      return "read.text";
  }
}

export function isIndexableFormat(format: FileFormat): boolean {
  return INDEXABLE_FORMATS.has(format);
}

/**
 * Index pipeline processor when the format is indexable; otherwise undefined.
 */
export function indexProcessorForFormat(
  format: FileFormat,
): "index.text" | undefined {
  return isIndexableFormat(format) ? "index.text" : undefined;
}
