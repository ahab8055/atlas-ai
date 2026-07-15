/**
 * Model registry domain types (Architecture/25 metadata + story fields).
 */
import type { ModelFormat, ModelStatus } from "../types.js";

export interface ModelRequirements {
  minRamGb?: number;
  gpuLayersRecommended?: number;
  acceleration?: "cpu" | "gpu" | "any";
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
