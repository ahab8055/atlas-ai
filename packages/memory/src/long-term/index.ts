/**
 * Long-term memory facade — sync SQLite CRUD + relevance search.
 */
import type {
  LongTermMemoryType,
  MemoriesRepository,
  MemoryRow,
} from "@atlas-ai/database";

import {
  classifyMemory,
  purgeExpiredMemories,
  type ClassificationThresholds,
  type MemoryClassificationInput,
  type MemoryClassificationResult,
  type PurgeExpiredResult,
} from "../classification/index.js";
import { MemoryError } from "../errors.js";
import { toMemorySnippets } from "../manager.js";
import type {
  CreateMemoryInput,
  MemoryRecord,
  MemorySnippetView,
  UpdateMemoryInput,
} from "../types.js";
import { isLongTermType, scopeForType } from "../types.js";

export interface EvaluateAndStoreExtras {
  explicitRemember?: boolean;
  frequency?: number;
  tags?: string[];
  sessionId?: string;
  metadata?: Record<string, unknown>;
  thresholds?: Partial<ClassificationThresholds>;
}

export interface EvaluateAndStoreResult {
  stored: boolean;
  record?: MemoryRecord;
  classification: MemoryClassificationResult;
}

export interface LongTermSearchOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  limit?: number;
  userId?: string;
}

export interface LongTermListOptions extends LongTermSearchOptions {
  sessionId?: string;
}

export class LongTermMemory {
  constructor(private readonly repo: MemoriesRepository) {}

  store(input: CreateMemoryInput): MemoryRecord {
    if (!isLongTermType(input.type)) {
      throw new MemoryError(
        "LongTermMemory only accepts episodic, semantic, or procedural types",
        { code: "invalid_input", type: input.type },
      );
    }
    const type = input.type;
    const row = this.repo.upsert({
      id: input.id,
      type,
      content: input.content,
      importance: input.importance,
      confidence: input.confidence,
      sessionId: input.sessionId,
      metadata: input.metadata,
      tags: input.tags,
    });
    return rowToRecord(row);
  }

  get(id: string): MemoryRecord | undefined {
    const row = this.repo.get(id);
    return row ? rowToRecord(row) : undefined;
  }

  update(id: string, patch: UpdateMemoryInput): MemoryRecord {
    try {
      const row = this.repo.update(id, {
        content: patch.content,
        importance: patch.importance,
        confidence: patch.confidence,
        sessionId: patch.sessionId,
        metadata: patch.metadata,
        tags: patch.tags,
      });
      return rowToRecord(row);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw MemoryError.notFound(id);
      }
      throw error;
    }
  }

  delete(id: string): boolean {
    return this.repo.delete(id);
  }

  list(options: LongTermListOptions = {}): MemoryRecord[] {
    return this.repo
      .list({
        type: options.type,
        tags: options.tags,
        sessionId: options.sessionId,
        userId: options.userId,
        limit: options.limit ?? 50,
      })
      .map(rowToRecord);
  }

  /** Relevance-ranked search (token hits + importance + recency). */
  search(text: string, options: LongTermSearchOptions = {}): MemoryRecord[] {
    const limit = options.limit ?? 5;
    const candidates = this.repo.list({
      type: options.type,
      tags: options.tags,
      userId: options.userId,
      limit: Math.max(limit * 10, 50),
    });
    return this.repo
      .rankByRelevance(candidates, text)
      .slice(0, limit)
      .map(rowToRecord);
  }

  /**
   * Classify candidate text and store only when action is store_long_term.
   * Discard / short_term do not write SQLite.
   */
  evaluateAndStore(
    text: string,
    extras: EvaluateAndStoreExtras = {},
  ): EvaluateAndStoreResult {
    const input: MemoryClassificationInput = {
      text,
      explicitRemember: extras.explicitRemember,
      frequency: extras.frequency,
    };
    const classification = classifyMemory(input, {
      thresholds: extras.thresholds,
    });

    if (classification.action !== "store_long_term") {
      return { stored: false, classification };
    }

    if (
      classification.suggestedType === "none" ||
      !isLongTermType(classification.suggestedType)
    ) {
      return { stored: false, classification };
    }

    const metadata: Record<string, unknown> = {
      ...(extras.metadata ?? {}),
    };
    if (classification.expiresAt) {
      metadata.expiresAt = classification.expiresAt;
    }

    const record = this.store({
      type: classification.suggestedType,
      content: text.trim(),
      importance: classification.importance,
      confidence: classification.confidence,
      tags: extras.tags,
      sessionId: extras.sessionId,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    return { stored: true, record, classification };
  }

  /** Delete long-term rows whose metadata.expiresAt is in the past. */
  purgeExpired(
    now?: () => number,
    options?: { limit?: number; userId?: string },
  ): PurgeExpiredResult {
    return purgeExpiredMemories(this.repo, now, options);
  }

  /** Sync retriever for core ContextManager createMemoryProvider. */
  createRetriever(
    options: { limit?: number } = {},
  ): (input: {
    sessionId: string;
    text: string;
    intentName: string;
  }) => MemorySnippetView[] {
    const limit = options.limit ?? 5;
    return (input) => {
      const text = input.text?.trim();
      if (!text) {
        return [];
      }
      const hits = this.search(text, { limit });
      return toMemorySnippets(hits, text);
    };
  }
}

export function createLongTermMemory(repo: MemoriesRepository): LongTermMemory {
  return new LongTermMemory(repo);
}

function rowToRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    type: row.type,
    scope: scopeForType(row.type),
    content: row.content,
    importance: row.importance,
    confidence: row.confidence,
    tags: row.tags.length > 0 ? [...row.tags] : undefined,
    sessionId: row.sessionId,
    metadata: { ...row.metadata },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
