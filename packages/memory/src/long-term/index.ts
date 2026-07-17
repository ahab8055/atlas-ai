/**
 * Long-term memory facade — sync SQLite CRUD + hybrid retrieval.
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
import {
  consolidateAgainstText,
  consolidateMemories,
  mergeMetadata,
  readConflict,
  type ConsolidateAgainstResult,
  type ConsolidateOptions,
  type ConsolidationResult,
  type ConsolidationThresholds,
} from "../consolidation/index.js";
import { MemoryError } from "../errors.js";
import {
  createMemoryRetrievalEngine,
  type MemoryEmbeddingLookup,
  type MemoryRetrievalEngine,
  type RetrievalOptions,
  type RetrievedMemory,
} from "../retrieval/index.js";
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
  /** Override consolidation thresholds / disable consolidate-on-store. */
  consolidation?: Partial<ConsolidationThresholds>;
  consolidateOnStore?: boolean;
}

export interface EvaluateAndStoreResult {
  stored: boolean;
  record?: MemoryRecord;
  classification: MemoryClassificationResult;
  consolidation?: ConsolidateAgainstResult;
}

export interface LongTermSearchOptions extends RetrievalOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  userId?: string;
}

export interface LongTermListOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  limit?: number;
  userId?: string;
  sessionId?: string;
}

export interface LongTermMemoryOptions {
  embeddingLookup?: MemoryEmbeddingLookup;
  /** Best-effort index hook after successful store (must not throw). */
  onStored?: (record: MemoryRecord) => void;
}

export class LongTermMemory {
  private readonly engine: MemoryRetrievalEngine;
  private readonly onStored?: (record: MemoryRecord) => void;

  constructor(
    private readonly repo: MemoriesRepository,
    options: LongTermMemoryOptions = {},
  ) {
    this.engine = createMemoryRetrievalEngine(repo, {
      embeddingLookup: options.embeddingLookup,
    });
    this.onStored = options.onStored;
  }

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
    const record = rowToRecord(row);
    this.invokeOnStored(record);
    return record;
  }

  get(id: string): MemoryRecord | undefined {
    const row = this.repo.get(id);
    return row ? rowToRecord(row) : undefined;
  }

  update(id: string, patch: UpdateMemoryInput): MemoryRecord {
    try {
      const existing = this.repo.get(id);
      if (!existing) {
        throw MemoryError.notFound(id);
      }
      const metadata =
        patch.metadata !== undefined
          ? mergeMetadata(existing.metadata, patch.metadata)
          : undefined;
      const row = this.repo.update(id, {
        content: patch.content,
        importance: patch.importance,
        confidence: patch.confidence,
        sessionId: patch.sessionId,
        metadata,
        tags: patch.tags,
      });
      const record = rowToRecord(row);
      this.invokeOnStored(record);
      return record;
    } catch (error) {
      if (error instanceof MemoryError) {
        throw error;
      }
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

  /** Hybrid relevance search (semantic + lexical + importance + recency). */
  search(text: string, options: LongTermSearchOptions = {}): MemoryRecord[] {
    return this.retrieve(text, options).map((hit) => hit.record);
  }

  /** Full ranked retrieval with scores. */
  retrieve(text: string, options: RetrievalOptions = {}): RetrievedMemory[] {
    return this.engine.retrieve(text, options);
  }

  /**
   * Classify candidate text and store only when action is store_long_term.
   * When consolidate-on-store is enabled, merges/updates near-duplicates first.
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

    const consolidateOnStore =
      extras.consolidateOnStore ??
      extras.consolidation?.consolidateOnStore ??
      true;

    if (consolidateOnStore) {
      const consolidation = consolidateAgainstText(
        this.asStore(),
        text.trim(),
        {
          type: classification.suggestedType,
          importance: classification.importance,
          confidence: classification.confidence,
          tags: extras.tags,
          sessionId: extras.sessionId,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          thresholds: extras.consolidation,
        },
      );
      return {
        stored: true,
        record: consolidation.record,
        classification,
        consolidation,
      };
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

  /** Batch near-duplicate merge + conflict flagging. */
  consolidate(options: ConsolidateOptions = {}): ConsolidationResult {
    return consolidateMemories(this.asStore(), options);
  }

  /** List memories with an open conflict flag. */
  listConflicts(options: LongTermListOptions = {}): MemoryRecord[] {
    return this.list({ ...options, limit: options.limit ?? 100 }).filter(
      (row) => readConflict(row.metadata)?.status === "open",
    );
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
    options: {
      limit?: number;
      minScore?: number;
      recencyHalfLifeMs?: number;
    } = {},
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
      const hits = this.retrieve(text, {
        limit,
        minScore: options.minScore,
        recencyHalfLifeMs: options.recencyHalfLifeMs,
      });
      return hits.map((hit) => ({
        id: hit.record.id,
        content: hit.record.content,
        kind: hit.record.type,
        score: hit.score,
      }));
    };
  }

  private invokeOnStored(record: MemoryRecord): void {
    if (!this.onStored) {
      return;
    }
    try {
      this.onStored(record);
    } catch {
      // Best-effort indexing must never block store
    }
  }

  private asStore() {
    return {
      list: (opts: LongTermListOptions) => this.list(opts),
      retrieve: (text: string, opts?: RetrievalOptions) =>
        this.retrieve(text, opts),
      get: (id: string) => this.get(id),
      update: (id: string, patch: UpdateMemoryInput) => this.update(id, patch),
      delete: (id: string) => this.delete(id),
      store: (input: CreateMemoryInput) => this.store(input),
    };
  }
}

export function createLongTermMemory(
  repo: MemoriesRepository,
  options: LongTermMemoryOptions = {},
): LongTermMemory {
  return new LongTermMemory(repo, options);
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
