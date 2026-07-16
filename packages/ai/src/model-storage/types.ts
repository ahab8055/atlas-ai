/**
 * Model storage domain types (Architecture/25 Model Storage Manager).
 */
import type { GgufValidationResult } from "../gguf.js";

/** Architecture/25 recommended category folders under models/. */
export const MODEL_CATEGORIES = [
  "general",
  "coding",
  "embeddings",
  "speech",
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

/** Root of modelsDir (legacy flat layout) or a named category. */
export type ModelStorageSlot = ModelCategory | "root";

export interface StoredModelFile {
  /** Registry-friendly id: basename or `category/basename` (no .gguf). */
  id: string;
  /** Absolute path to the weights file. */
  path: string;
  /** Path relative to modelsDir. */
  relativePath: string;
  slot: ModelStorageSlot;
  sizeBytes: number;
  validation: GgufValidationResult;
}

export interface CategoryUsage {
  slot: ModelStorageSlot;
  fileCount: number;
  totalBytes: number;
  validCount: number;
  invalidCount: number;
}

export interface StorageUsageReport {
  modelsDir: string;
  /** Whether category directories exist (created by ensureStructure). */
  structureReady: boolean;
  fileCount: number;
  totalBytes: number;
  validCount: number;
  invalidCount: number;
  bySlot: CategoryUsage[];
  models: StoredModelFile[];
}

export interface ModelRemovalResult {
  id: string;
  removed: boolean;
  path?: string;
  reason?: string;
}

export interface EnsureStructureResult {
  modelsDir: string;
  created: string[];
  existing: string[];
}
