/**
 * SQLite-backed MemoryProvider for long-term types.
 */
import type {
  LongTermMemoryType,
  MemoriesRepository,
} from "@atlas-ai/database";

import { MemoryError } from "../errors.js";
import type { MemoryProvider } from "../provider.js";
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  UpdateMemoryInput,
} from "../types.js";
import { scopeForType } from "../types.js";

export class SqliteMemoryProvider implements MemoryProvider {
  constructor(
    readonly type: LongTermMemoryType,
    private readonly repo: MemoriesRepository,
  ) {}

  async store(input: CreateMemoryInput): Promise<MemoryRecord> {
    if (input.type !== this.type) {
      throw new MemoryError(
        `Provider ${this.type} cannot store type ${input.type}`,
        { code: "invalid_input", type: this.type },
      );
    }
    const row = this.repo.upsert({
      id: input.id,
      type: this.type,
      content: input.content,
      importance: input.importance,
      confidence: input.confidence,
      sessionId: input.sessionId,
      projectId: input.projectId,
      metadata: input.metadata,
      tags: input.tags,
    });
    return toMemoryRecord(row);
  }

  async get(id: string): Promise<MemoryRecord | undefined> {
    const row = this.repo.get(id);
    if (!row || row.type !== this.type) {
      return undefined;
    }
    return toMemoryRecord(row);
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<MemoryRecord> {
    const existing = this.repo.get(id);
    if (!existing || existing.type !== this.type) {
      throw MemoryError.notFound(id);
    }
    const row = this.repo.update(id, {
      content: patch.content,
      importance: patch.importance,
      confidence: patch.confidence,
      sessionId: patch.sessionId,
      projectId: patch.projectId,
      metadata: patch.metadata,
      tags: patch.tags,
    });
    return toMemoryRecord(row);
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.repo.get(id);
    if (!existing || existing.type !== this.type) {
      return false;
    }
    return this.repo.delete(id);
  }

  async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    if (query.type !== undefined && query.type !== this.type) {
      return [];
    }
    if (query.scope !== undefined && query.scope !== "long_term") {
      return [];
    }
    const rows = this.repo.list({
      type: this.type,
      sessionId: query.sessionId,
      projectId: query.projectId,
      projectIdOrUnscoped: query.projectIdOrUnscoped,
      tags: query.tags,
      text: query.text,
      limit: query.limit ?? 50,
    });
    return rows.map(toMemoryRecord);
  }

  async clear(options?: ClearMemoryOptions): Promise<number> {
    if (options?.sessionId !== undefined) {
      const rows = this.repo.list({
        type: this.type,
        sessionId: options.sessionId,
        limit: 10_000,
      });
      let removed = 0;
      for (const row of rows) {
        if (this.repo.delete(row.id)) {
          removed += 1;
        }
      }
      return removed;
    }
    return this.repo.clearByType(this.type);
  }
}

function toMemoryRecord(row: {
  id: string;
  type: LongTermMemoryType;
  content: string;
  importance?: number;
  confidence?: number;
  sessionId?: string;
  projectId?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}): MemoryRecord {
  return {
    id: row.id,
    type: row.type,
    scope: scopeForType(row.type),
    content: row.content,
    importance: row.importance,
    confidence: row.confidence,
    tags: row.tags.length > 0 ? [...row.tags] : undefined,
    sessionId: row.sessionId,
    projectId: row.projectId,
    metadata: { ...row.metadata },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
