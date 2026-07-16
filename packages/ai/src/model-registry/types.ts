/**
 * Model registry domain types (Architecture/25 metadata + story fields).
 */
import type { ModelFormat, ModelStatus } from "../types.js";

export interface ModelRequirements {
  minRamGb?: number;
  /** Minimum logical CPU processors. */
  minLogicalProcessors?: number;
  /** @deprecated Prefer minLogicalProcessors. */
  minCpuCores?: number;
  gpuLayersRecommended?: number;
  /** Soft preference: cpu | gpu | any. */
  acceleration?: "cpu" | "gpu" | "any";
  /** Hard GPU requirement — blocks runtime when unmet. */
  requireGpu?: boolean;
  /** Minimum free disk space in GB near the model store. */
  minFreeStorageGb?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface RegisteredModel {
  id: string;
  name: string;
  version: string;
  format: ModelFormat;
  sizeBytes?: number;
  contextLength?: number;
  capabilities: string[];
  requirements: ModelRequirements;
  location?: string;
  provider: string;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterModelInput {
  id: string;
  name: string;
  provider: string;
  version?: string;
  format?: ModelFormat;
  sizeBytes?: number;
  contextLength?: number;
  capabilities?: string[];
  requirements?: ModelRequirements;
  location?: string;
  status?: ModelStatus;
}

export interface ModelRegistryQuery {
  status?: string;
  provider?: string;
  format?: string;
  capability?: string;
  limit?: number;
}

/**
 * Persistence port — implemented by SQLite (`ModelsRepository`) or memory.
 */
export interface ModelRegistryStore {
  upsert(input: RegisterModelInput): RegisteredModel;
  get(id: string): RegisteredModel | undefined;
  list(query?: ModelRegistryQuery): RegisteredModel[];
  remove(id: string): boolean;
}
