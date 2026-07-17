/**
 * Shared Map-backed CRUD for isolated in-memory providers.
 * Each provider owns its own store instance — types stay isolated.
 */
import { randomUUID } from "node:crypto";

import { MemoryError } from "../errors.js";
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  MemoryType,
  UpdateMemoryInput,
} from "../types.js";
import { scopeForType } from "../types.js";

export class InMemoryStore {
  private readonly records = new Map<string, MemoryRecord>();

  constructor(private readonly type: MemoryType) {}

  async store(input: CreateMemoryInput): Promise<MemoryRecord> {
    if (input.type !== this.type) {
      throw new MemoryError(
        `Provider ${this.type} cannot store type ${input.type}`,
        { code: "invalid_input", type: this.type },
      );
    }
    const content = input.content?.trim();
    if (!content) {
      throw new MemoryError("Memory content is required", {
        code: "invalid_input",
        type: this.type,
      });
    }
    const now = new Date().toISOString();
    const id = input.id?.trim() || randomUUID();
    if (this.records.has(id)) {
      throw new MemoryError(`Memory already exists: ${id}`, {
        code: "invalid_input",
        type: this.type,
      });
    }
    const record: MemoryRecord = {
      id,
      type: this.type,
      scope: scopeForType(this.type),
      content,
      importance: input.importance,
      confidence: input.confidence,
      tags: input.tags ? [...input.tags] : undefined,
      sessionId: input.sessionId,
      metadata: input.metadata ? { ...input.metadata } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, record);
    return { ...record, tags: record.tags ? [...record.tags] : undefined };
  }

  async get(id: string): Promise<MemoryRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<MemoryRecord> {
    const existing = this.records.get(id);
    if (!existing) {
      throw MemoryError.notFound(id);
    }
    const content =
      patch.content !== undefined ? patch.content.trim() : existing.content;
    if (!content) {
      throw new MemoryError("Memory content is required", {
        code: "invalid_input",
        type: this.type,
      });
    }
    const updated: MemoryRecord = {
      ...existing,
      content,
      importance:
        patch.importance !== undefined ? patch.importance : existing.importance,
      confidence:
        patch.confidence !== undefined ? patch.confidence : existing.confidence,
      tags: patch.tags !== undefined ? [...patch.tags] : existing.tags,
      sessionId:
        patch.sessionId !== undefined ? patch.sessionId : existing.sessionId,
      metadata:
        patch.metadata !== undefined
          ? { ...patch.metadata }
          : existing.metadata,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return cloneRecord(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    if (query.type !== undefined && query.type !== this.type) {
      return [];
    }
    if (query.scope !== undefined && query.scope !== scopeForType(this.type)) {
      return [];
    }

    let results = [...this.records.values()];

    if (query.sessionId !== undefined) {
      results = results.filter((r) => r.sessionId === query.sessionId);
    }
    if (query.tags && query.tags.length > 0) {
      const wanted = new Set(query.tags);
      results = results.filter(
        (r) => r.tags?.some((t) => wanted.has(t)) === true,
      );
    }
    if (query.text?.trim()) {
      const needle = query.text.trim().toLowerCase();
      results = results.filter((r) => r.content.toLowerCase().includes(needle));
    }

    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const limit = query.limit ?? results.length;
    return results.slice(0, Math.max(0, limit)).map(cloneRecord);
  }

  async clear(options?: ClearMemoryOptions): Promise<number> {
    if (options?.sessionId === undefined) {
      const count = this.records.size;
      this.records.clear();
      return count;
    }
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.sessionId === options.sessionId) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

function cloneRecord(record: MemoryRecord): MemoryRecord {
  return {
    ...record,
    tags: record.tags ? [...record.tags] : undefined,
    metadata: record.metadata ? { ...record.metadata } : undefined,
  };
}
