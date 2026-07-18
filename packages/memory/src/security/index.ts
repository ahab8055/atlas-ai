/**
 * Memory security types and helpers (ADR-0056).
 */
import type { Logger } from "@atlas-ai/logging";
import {
  decryptAesGcm,
  encryptAesGcm,
  isSensitiveFieldName,
  type PermissionManager,
} from "@atlas-ai/security";

import { MemoryError } from "../errors.js";

export type MemorySensitivity = "normal" | "sensitive";

export type MemoryAccessAction =
  "create" | "read" | "update" | "delete" | "search";

export interface MemoryAccessEvent {
  action: MemoryAccessAction;
  memoryId?: string;
  sensitivity?: MemorySensitivity;
  granted: boolean;
  capability: "memory.read" | "memory.write" | "memory.delete";
  secure?: boolean;
  at: string;
  reason?: string;
}

/** Sync DEK provider — key loaded once at runtime from SecureStorage. */
export interface MemoryDekProvider {
  getKey(): Uint8Array;
}

export interface EncryptedContent {
  ciphertext: string;
  nonce: string;
}

export function createMemoryCrypto(dek: MemoryDekProvider) {
  return {
    encrypt(plaintext: string): EncryptedContent {
      const payload = encryptAesGcm(plaintext, dek.getKey());
      return { ciphertext: payload.ciphertext, nonce: payload.nonce };
    },
    decrypt(ciphertext: string, nonce: string): string {
      return decryptAesGcm({ ciphertext, nonce, version: 1 }, dek.getKey());
    },
  };
}

export type MemoryCrypto = ReturnType<typeof createMemoryCrypto>;

export class MemoryAccessLog {
  private readonly events: MemoryAccessEvent[] = [];

  record(
    event: Omit<MemoryAccessEvent, "at"> & { at?: string },
  ): MemoryAccessEvent {
    const full: MemoryAccessEvent = {
      ...event,
      at: event.at ?? new Date().toISOString(),
    };
    this.events.push(full);
    return full;
  }

  list(): readonly MemoryAccessEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }
}

export function createStaticDekProvider(key: Uint8Array): MemoryDekProvider {
  return { getKey: () => key };
}

/**
 * Record access + emit redacted security log (never include memory content).
 */
export function auditMemoryAccess(
  accessLog: MemoryAccessLog | undefined,
  logger: Logger | undefined,
  event: Omit<MemoryAccessEvent, "at"> & { at?: string },
): void {
  const recorded = accessLog?.record(event) ?? {
    ...event,
    at: event.at ?? new Date().toISOString(),
  };
  logger?.info(`memory.${recorded.action}`, {
    category: "security",
    context: {
      action: recorded.action,
      memoryId: recorded.memoryId,
      sensitivity: recorded.sensitivity,
      granted: recorded.granted,
      capability: recorded.capability,
      secure: recorded.secure,
      reason: recorded.reason,
    },
  });
}

export function requireMemoryPermission(
  permissions: PermissionManager | undefined,
  capability: "memory.read" | "memory.write" | "memory.delete",
  reason: string,
  resource?: string,
): void {
  if (!permissions) {
    return;
  }
  const result = permissions.requestPermission({
    capability,
    reason,
    resource,
  });
  if (result.blocked) {
    throw MemoryError.permissionDenied(capability, result.evaluation.message);
  }
}

/** True when content looks like a secret that must not be stored as plaintext. */
export function looksLikeSecretContent(content: string): boolean {
  const lower = content.toLowerCase();
  if (
    /api[_-]?key\s*[:=]/i.test(lower) ||
    /password\s*[:=]/i.test(lower) ||
    /secret\s*[:=]/i.test(lower) ||
    /bearer\s+[a-z0-9._-]+/i.test(content)
  ) {
    return true;
  }
  const tokens = content.split(/[\s:=]+/).slice(0, 4);
  return tokens.some((t) => isSensitiveFieldName(t));
}
