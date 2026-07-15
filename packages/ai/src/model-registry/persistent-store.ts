/**
 * Structural adapter so callers can bind SQLite ModelsRepository without
 * `@atlas-ai/ai` depending on `@atlas-ai/database`.
 */
import type {
  ModelRegistryQuery,
  ModelRegistryStore,
  RegisterModelInput,
  RegisteredModel,
} from "./types.js";

/** Row shape returned by ModelsRepository (and compatible stores). */
export interface PersistentModelRow {
  id: string;
  name: string;
  provider: string;
  version?: string;
  format?: string;
  sizeBytes?: number;
  contextLength?: number;
  capabilities: string[];
  requirements: Record<string, unknown>;
  location?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Duck-typed persistence matching ModelsRepository. */
export interface PersistentModelsApi {
  upsert(input: {
    id: string;
    name: string;
    provider: string;
    version?: string;
    format?: string;
    sizeBytes?: number;
    contextLength?: number;
    capabilities?: string[];
    requirements?: Record<string, unknown>;
    location?: string;
    status?: string;
  }): PersistentModelRow;
  get(id: string): PersistentModelRow | undefined;
  list(query?: {
    status?: string;
    provider?: string;
    format?: string;
    capability?: string;
    limit?: number;
  }): PersistentModelRow[];
  remove(id: string): boolean;
}

function toRegistered(row: PersistentModelRow): RegisteredModel {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    version: row.version ?? "1.0.0",
    format: (row.format as RegisteredModel["format"]) ?? "unknown",
    sizeBytes: row.sizeBytes,
    contextLength: row.contextLength,
    capabilities: [...row.capabilities],
    requirements: { ...row.requirements },
    location: row.location,
    status: row.status as RegisteredModel["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPersistentModelRegistryStore(
  api: PersistentModelsApi,
): ModelRegistryStore {
  return {
    upsert(input: RegisterModelInput): RegisteredModel {
      return toRegistered(
        api.upsert({
          id: input.id,
          name: input.name,
          provider: input.provider,
          version: input.version,
          format: input.format,
          sizeBytes: input.sizeBytes,
          contextLength: input.contextLength,
          capabilities: input.capabilities,
          requirements: input.requirements,
          location: input.location,
          status: input.status,
        }),
      );
    },
    get(id: string): RegisteredModel | undefined {
      const row = api.get(id);
      return row ? toRegistered(row) : undefined;
    },
    list(query: ModelRegistryQuery = {}): RegisteredModel[] {
      return api.list(query).map(toRegistered);
    },
    remove(id: string): boolean {
      return api.remove(id);
    },
  };
}
