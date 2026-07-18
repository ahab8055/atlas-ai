/**
 * Long-term memory facade — sync SQLite CRUD + hybrid retrieval.
 */
import type {
  LongTermMemoryType,
  MemoriesRepository,
  MemoryRow,
} from "@atlas-ai/database";
import type { Logger } from "@atlas-ai/logging";
import type { PermissionManager } from "@atlas-ai/security";

import {
  buildSnapshot,
  validateSnapshot,
  type BackupValidationResult,
  type ImportBackupMode,
  type ImportBackupResult,
  type MemoryBackupSnapshot,
} from "../backup/index.js";
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
  type MemoryEmbeddingLookup,
  type RetrievalOptions,
  type RetrievedMemory,
} from "../retrieval/index.js";
import {
  createMemorySearchApi,
  type MemorySearchApi,
  type MemorySearchMode,
  type MemorySearchQuery,
  type MemorySearchResult,
} from "../search/index.js";
import {
  auditMemoryAccess,
  createMemoryCrypto,
  looksLikeSecretContent,
  requireMemoryPermission,
  type MemoryAccessLog,
  type MemoryCrypto,
  type MemoryDekProvider,
  type MemorySensitivity,
} from "../security/index.js";
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
  projectId?: string;
  sensitivity?: MemorySensitivity;
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
  mode?: MemorySearchMode;
}

export interface LongTermListOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  limit?: number;
  userId?: string;
  sessionId?: string;
  projectId?: string;
  projectIdOrUnscoped?: string;
}

export interface ExportBackupOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  projectId?: string;
  userId?: string;
  /** Default 50_000 so full exports are not truncated at list default 50. */
  limit?: number;
}

export interface ImportBackupOptions {
  mode?: ImportBackupMode;
  type?: LongTermMemoryType;
  userId?: string;
}

/** Default export pool size (ADR-0057). */
export const DEFAULT_BACKUP_EXPORT_LIMIT = 50_000;

export interface LongTermMemoryOptions {
  embeddingLookup?: MemoryEmbeddingLookup;
  /** Best-effort index hook after successful store (must not throw). */
  onStored?: (record: MemoryRecord) => void;
  permissions?: PermissionManager;
  dek?: MemoryDekProvider;
  accessLog?: MemoryAccessLog;
  logger?: Logger;
}

export class LongTermMemory {
  private readonly searchApi: MemorySearchApi;
  private readonly onStored?: (record: MemoryRecord) => void;
  private readonly permissions?: PermissionManager;
  private readonly crypto?: MemoryCrypto;
  private readonly accessLog?: MemoryAccessLog;
  private readonly logger?: Logger;

  constructor(
    private readonly repo: MemoriesRepository,
    options: LongTermMemoryOptions = {},
  ) {
    this.permissions = options.permissions;
    this.accessLog = options.accessLog;
    this.logger = options.logger;
    this.crypto = options.dek ? createMemoryCrypto(options.dek) : undefined;
    this.searchApi = createMemorySearchApi(repo, {
      embeddingLookup: options.embeddingLookup,
      transformRow: (row) => this.decryptRowOrSkip(row),
    });
    this.onStored = options.onStored;
  }

  store(input: CreateMemoryInput): MemoryRecord {
    requireMemoryPermission(
      this.permissions,
      "memory.write",
      "store long-term memory",
    );
    if (!isLongTermType(input.type)) {
      throw new MemoryError(
        "LongTermMemory only accepts episodic, semantic, or procedural types",
        { code: "invalid_input", type: input.type },
      );
    }
    const sensitivity = input.sensitivity ?? "normal";
    const plaintext = input.content.trim();
    this.assertPersistable(plaintext, sensitivity);

    const prepared = this.prepareForPersist(plaintext, sensitivity);
    const type = input.type;
    const row = this.repo.upsert({
      id: input.id,
      type,
      content: prepared.content,
      importance: input.importance,
      confidence: input.confidence,
      sessionId: input.sessionId,
      projectId: input.projectId,
      sensitivity,
      encrypted: prepared.encrypted,
      contentNonce: prepared.contentNonce,
      metadata: input.metadata,
      tags: input.tags,
    });
    const record = this.toDecryptedRecord(row);
    this.audit("create", {
      memoryId: record.id,
      sensitivity,
      capability: "memory.write",
      granted: true,
    });
    this.invokeOnStored(record);
    return record;
  }

  get(id: string): MemoryRecord | undefined {
    requireMemoryPermission(
      this.permissions,
      "memory.read",
      "read long-term memory",
      id,
    );
    const row = this.repo.get(id);
    if (!row) {
      return undefined;
    }
    const record = this.toDecryptedRecord(row);
    this.audit("read", {
      memoryId: id,
      sensitivity: row.sensitivity,
      capability: "memory.read",
      granted: true,
    });
    return record;
  }

  update(id: string, patch: UpdateMemoryInput): MemoryRecord {
    requireMemoryPermission(
      this.permissions,
      "memory.write",
      "update long-term memory",
      id,
    );
    try {
      const existing = this.repo.get(id);
      if (!existing) {
        throw MemoryError.notFound(id);
      }
      const sensitivity = patch.sensitivity ?? existing.sensitivity;
      const plaintext =
        patch.content !== undefined
          ? patch.content.trim()
          : this.decryptRowContent(existing);
      this.assertPersistable(plaintext, sensitivity);
      const prepared = this.prepareForPersist(plaintext, sensitivity);
      const metadata =
        patch.metadata !== undefined
          ? mergeMetadata(existing.metadata, patch.metadata)
          : undefined;
      const row = this.repo.update(id, {
        content: prepared.content,
        importance: patch.importance,
        confidence: patch.confidence,
        sessionId: patch.sessionId,
        projectId: patch.projectId,
        sensitivity,
        encrypted: prepared.encrypted,
        contentNonce: prepared.contentNonce,
        metadata,
        tags: patch.tags,
      });
      const record = this.toDecryptedRecord(row);
      this.audit("update", {
        memoryId: id,
        sensitivity,
        capability: "memory.write",
        granted: true,
      });
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
    return this.wipeAndDelete(id, { checkPermission: true });
  }

  /**
   * Overwrite content then DELETE (secure deletion).
   */
  secureDelete(id: string): boolean {
    return this.wipeAndDelete(id, { checkPermission: true });
  }

  /**
   * Secure-delete all memories for the local user (or filtered type).
   */
  clear(options: { type?: LongTermMemoryType; userId?: string } = {}): number {
    requireMemoryPermission(
      this.permissions,
      "memory.delete",
      "clear long-term memories",
    );
    const rows = this.repo.list({
      type: options.type,
      userId: options.userId ?? "local",
      limit: 10_000,
    });
    let deleted = 0;
    for (const row of rows) {
      if (this.wipeAndDelete(row.id, { checkPermission: false })) {
        deleted += 1;
      }
    }
    return deleted;
  }

  list(options: LongTermListOptions = {}): MemoryRecord[] {
    requireMemoryPermission(
      this.permissions,
      "memory.read",
      "list long-term memories",
    );
    const rows = this.repo
      .list({
        type: options.type,
        tags: options.tags,
        sessionId: options.sessionId,
        projectId: options.projectId,
        projectIdOrUnscoped: options.projectIdOrUnscoped,
        userId: options.userId,
        limit: options.limit ?? 50,
      })
      .map((row) => this.decryptRowOrSkip(row))
      .filter((row): row is MemoryRow => row !== undefined)
      .map((row) => this.toDecryptedRecord(row, false));
    this.audit("read", {
      capability: "memory.read",
      granted: true,
      reason: `list:${rows.length}`,
    });
    return rows;
  }

  /** Relevance search via Memory Search API (ADR-0055); returns records only. */
  search(text: string, options: LongTermSearchOptions = {}): MemoryRecord[] {
    return this.retrieve(text, options).map((hit) => hit.record);
  }

  /** Full ranked retrieval with scores (delegates to Memory Search API). */
  retrieve(
    text: string,
    options: LongTermSearchOptions = {},
  ): RetrievedMemory[] {
    requireMemoryPermission(
      this.permissions,
      "memory.read",
      "retrieve long-term memories",
    );
    const mode = options.mode ?? "hybrid";
    const result = this.searchApi.search({
      query: text,
      mode,
      type: options.type,
      tags: options.tags,
      userId: options.userId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      limit: options.limit,
      minScore: options.minScore,
      recencyHalfLifeMs: options.recencyHalfLifeMs,
    });
    this.audit("search", {
      capability: "memory.read",
      granted: true,
      reason: `hits:${result.hits.length}`,
    });
    return result.hits.map((h) => ({
      record: h.record,
      score: h.score,
      breakdown: h.breakdown!,
    }));
  }

  /** Unified search entry returning mode + timing (ADR-0055). */
  searchMemories(input: MemorySearchQuery): MemorySearchResult {
    requireMemoryPermission(
      this.permissions,
      "memory.read",
      "search long-term memories",
    );
    const result = this.searchApi.search(input);
    this.audit("search", {
      capability: "memory.read",
      granted: true,
      reason: `mode:${result.mode}`,
    });
    return result;
  }

  /** Expose Search API for modules that prefer the facade directly. */
  asSearchApi(): MemorySearchApi {
    return this.searchApi;
  }

  /**
   * Export decrypted long-term memories as a versioned backup snapshot (ADR-0057).
   */
  exportBackup(options: ExportBackupOptions = {}): MemoryBackupSnapshot {
    requireMemoryPermission(
      this.permissions,
      "memory.read",
      "export memory backup",
    );
    const limit = options.limit ?? DEFAULT_BACKUP_EXPORT_LIMIT;
    const records = this.list({
      type: options.type,
      tags: options.tags,
      projectId: options.projectId,
      userId: options.userId,
      limit,
    });
    const snapshot = buildSnapshot(records);
    this.audit("read", {
      capability: "memory.read",
      granted: true,
      reason: `export:${snapshot.count}`,
    });
    return snapshot;
  }

  /** Validate a plaintext backup snapshot (checksum + schema). */
  validateBackup(input: unknown): BackupValidationResult {
    return validateSnapshot(input);
  }

  /**
   * Import a validated snapshot. merge upserts by id; replace clears then imports.
   */
  importBackup(
    snapshot: MemoryBackupSnapshot,
    options: ImportBackupOptions = {},
  ): ImportBackupResult {
    requireMemoryPermission(
      this.permissions,
      "memory.write",
      "import memory backup",
    );
    const validated = validateSnapshot(snapshot);
    if (!validated.ok || !validated.snapshot) {
      return {
        imported: 0,
        skipped: 0,
        errors: validated.errors,
      };
    }
    const mode = options.mode ?? "merge";
    if (mode === "replace") {
      requireMemoryPermission(
        this.permissions,
        "memory.delete",
        "replace memory backup",
      );
      this.clear({ type: options.type, userId: options.userId });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const row of validated.snapshot.memories) {
      if (options.type && row.type !== options.type) {
        skipped += 1;
        continue;
      }
      try {
        this.store({
          id: row.id,
          type: row.type,
          content: row.content,
          importance: row.importance,
          confidence: row.confidence,
          tags: row.tags,
          sessionId: row.sessionId,
          projectId: row.projectId,
          sensitivity: row.sensitivity ?? "normal",
          metadata: row.metadata,
        });
        imported += 1;
      } catch (error) {
        skipped += 1;
        errors.push(
          `${row.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this.audit("create", {
      capability: "memory.write",
      granted: true,
      reason: `import:${imported}`,
    });
    return { imported, skipped, errors };
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
          projectId: extras.projectId,
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
      projectId: extras.projectId,
      sensitivity: extras.sensitivity,
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
    requireMemoryPermission(
      this.permissions,
      "memory.delete",
      "purge expired memories",
    );
    return purgeExpiredMemories(this.repo, now, options);
  }

  /** Sync retriever for core ContextManager createMemoryProvider. */
  createRetriever(
    options: {
      limit?: number;
      minScore?: number;
      recencyHalfLifeMs?: number;
      projectId?: string;
      mode?: MemorySearchMode;
      sessionId?: string;
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
        mode: options.mode ?? "hybrid",
        limit,
        minScore: options.minScore,
        recencyHalfLifeMs: options.recencyHalfLifeMs,
        projectId: options.projectId,
        // Only filter when caller opts in — do not use conversation sessionId.
        sessionId: options.sessionId,
      });
      return hits.map((hit) => ({
        id: hit.record.id,
        content: hit.record.content,
        kind: hit.record.type,
        score: hit.score,
      }));
    };
  }

  private wipeAndDelete(
    id: string,
    options: { checkPermission: boolean },
  ): boolean {
    if (options.checkPermission) {
      requireMemoryPermission(
        this.permissions,
        "memory.delete",
        "secure delete long-term memory",
        id,
      );
    }
    const existing = this.repo.get(id);
    if (!existing) {
      return false;
    }
    const wipe = "\0".repeat(Math.max(existing.content.length, 1));
    this.repo.update(id, {
      content: wipe,
      contentNonce: null,
      encrypted: false,
      sensitivity: existing.sensitivity,
    });
    const ok = this.repo.delete(id);
    this.audit("delete", {
      memoryId: id,
      sensitivity: existing.sensitivity,
      capability: "memory.delete",
      granted: true,
      secure: true,
    });
    return ok;
  }

  private assertPersistable(
    plaintext: string,
    sensitivity: MemorySensitivity,
  ): void {
    if (sensitivity === "sensitive" && !this.crypto) {
      throw new MemoryError(
        "Sensitive memories require a data encryption key (DEK)",
        { code: "encryption_required" },
      );
    }
    if (looksLikeSecretContent(plaintext) && sensitivity !== "sensitive") {
      throw new MemoryError(
        "Secret-shaped content must be stored with sensitivity: sensitive (or use SecureStorage)",
        { code: "encryption_required" },
      );
    }
  }

  private prepareForPersist(
    plaintext: string,
    sensitivity: MemorySensitivity,
  ): {
    content: string;
    encrypted: boolean;
    contentNonce: string | null;
  } {
    if (sensitivity !== "sensitive") {
      return { content: plaintext, encrypted: false, contentNonce: null };
    }
    if (!this.crypto) {
      throw new MemoryError(
        "Sensitive memories require a data encryption key (DEK)",
        { code: "encryption_required" },
      );
    }
    const enc = this.crypto.encrypt(plaintext);
    return {
      content: enc.ciphertext,
      encrypted: true,
      contentNonce: enc.nonce,
    };
  }

  private decryptRowContent(row: MemoryRow): string {
    if (!row.encrypted) {
      return row.content;
    }
    if (!this.crypto || !row.contentNonce) {
      throw new MemoryError(
        `Cannot decrypt memory ${row.id}: missing DEK or nonce`,
        { code: "decrypt_failed" },
      );
    }
    try {
      return this.crypto.decrypt(row.content, row.contentNonce);
    } catch (cause) {
      throw new MemoryError(`Failed to decrypt memory ${row.id}`, {
        code: "decrypt_failed",
        cause,
      });
    }
  }

  private decryptRowOrSkip(row: MemoryRow): MemoryRow | undefined {
    if (!row.encrypted) {
      return row;
    }
    try {
      const content = this.decryptRowContent(row);
      // Keep encrypted=true so callers know the row is encrypted at rest.
      return { ...row, content };
    } catch {
      this.audit("read", {
        memoryId: row.id,
        sensitivity: row.sensitivity,
        capability: "memory.read",
        granted: false,
        reason: "decrypt_failed",
      });
      return undefined;
    }
  }

  private toDecryptedRecord(row: MemoryRow, decrypt = true): MemoryRecord {
    const source = decrypt ? this.decryptRowOrSkip(row) : row;
    if (!source) {
      throw new MemoryError(`Failed to decrypt memory ${row.id}`, {
        code: "decrypt_failed",
      });
    }
    return {
      id: source.id,
      type: source.type,
      scope: scopeForType(source.type),
      content: source.content,
      importance: source.importance,
      confidence: source.confidence,
      tags: source.tags.length > 0 ? [...source.tags] : undefined,
      sessionId: source.sessionId,
      projectId: source.projectId,
      sensitivity: source.sensitivity,
      encrypted: row.encrypted,
      metadata: { ...source.metadata },
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  private audit(
    action: "create" | "read" | "update" | "delete" | "search",
    fields: {
      memoryId?: string;
      sensitivity?: MemorySensitivity;
      capability: "memory.read" | "memory.write" | "memory.delete";
      granted: boolean;
      secure?: boolean;
      reason?: string;
    },
  ): void {
    auditMemoryAccess(this.accessLog, this.logger, {
      action,
      ...fields,
    });
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
      // Consolidation merge deletes skip permission re-check (write already gated).
      delete: (id: string) =>
        this.wipeAndDelete(id, { checkPermission: false }),
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
