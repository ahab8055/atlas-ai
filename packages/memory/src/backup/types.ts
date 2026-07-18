/**
 * Memory backup snapshot format (ADR-0057).
 */
import type { LongTermMemoryKind } from "../types.js";
import type { MemorySensitivity } from "../security/index.js";

export const MEMORY_BACKUP_FORMAT = "atlas.memory.backup" as const;
export const MEMORY_BACKUP_ENCRYPTED_FORMAT =
  "atlas.memory.backup.encrypted" as const;
export const MEMORY_BACKUP_VERSION = 1 as const;

export interface MemoryBackupRecord {
  id: string;
  type: LongTermMemoryKind;
  content: string;
  importance?: number;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  projectId?: string;
  sensitivity?: MemorySensitivity;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryBackupSnapshot {
  format: typeof MEMORY_BACKUP_FORMAT;
  version: typeof MEMORY_BACKUP_VERSION;
  exportedAt: string;
  count: number;
  /** SHA-256 hex of canonical memories JSON. */
  checksum: string;
  memories: MemoryBackupRecord[];
}

export interface MemoryBackupEnvelope {
  format: typeof MEMORY_BACKUP_ENCRYPTED_FORMAT;
  version: typeof MEMORY_BACKUP_VERSION;
  kdf: "scrypt";
  salt: string;
  nonce: string;
  ciphertext: string;
}

export interface BackupValidationResult {
  ok: boolean;
  errors: string[];
  snapshot?: MemoryBackupSnapshot;
}

export interface ImportBackupResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export type ImportBackupMode = "merge" | "replace";
