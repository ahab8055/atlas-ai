import type {
  ModelRegistryQuery,
  ModelRegistryStore,
  RegisterModelInput,
  RegisteredModel,
} from "./types.js";

/**
 * In-memory store for tests and DB-less runs.
 */
export class InMemoryModelRegistryStore implements ModelRegistryStore {
  private readonly models = new Map<string, RegisteredModel>();

  upsert(input: RegisterModelInput): RegisteredModel {
    const now = new Date().toISOString();
    const existing = this.models.get(input.id);
    const row: RegisteredModel = {
      id: input.id,
      name: input.name,
      provider: input.provider,
      version: input.version ?? existing?.version ?? "1.0.0",
      format: input.format ?? existing?.format ?? "unknown",
      sizeBytes: input.sizeBytes ?? existing?.sizeBytes,
      contextLength: input.contextLength ?? existing?.contextLength,
      capabilities: input.capabilities ?? existing?.capabilities ?? [],
      requirements: input.requirements ?? existing?.requirements ?? {},
      location: input.location ?? existing?.location,
      status: input.status ?? existing?.status ?? "available",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.models.set(row.id, row);
    return {
      ...row,
      capabilities: [...row.capabilities],
      requirements: { ...row.requirements },
    };
  }

  get(id: string): RegisteredModel | undefined {
    const row = this.models.get(id);
    return row
      ? {
          ...row,
          capabilities: [...row.capabilities],
          requirements: { ...row.requirements },
        }
      : undefined;
  }

  list(query: ModelRegistryQuery = {}): RegisteredModel[] {
    let rows = [...this.models.values()];
    if (query.status) {
      rows = rows.filter((row) => row.status === query.status);
    }
    if (query.provider) {
      rows = rows.filter((row) => row.provider === query.provider);
    }
    if (query.format) {
      rows = rows.filter((row) => row.format === query.format);
    }
    if (query.capability) {
      rows = rows.filter((row) => row.capabilities.includes(query.capability!));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    if (typeof query.limit === "number" && query.limit > 0) {
      rows = rows.slice(0, query.limit);
    }
    return rows.map((row) => ({
      ...row,
      capabilities: [...row.capabilities],
      requirements: { ...row.requirements },
    }));
  }

  remove(id: string): boolean {
    return this.models.delete(id);
  }
}
