/**
 * AES-256-GCM helpers for field-level encryption (ADR-0056).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const AES_GCM_KEY_BYTES = 32;
export const AES_GCM_IV_BYTES = 12;
export const MEMORY_DEK_SECRET_ID = "atlas.memory.dek";

export interface AesGcmPayload {
  /** Base64 ciphertext (includes auth tag appended by Node cipher). */
  ciphertext: string;
  /** Base64 12-byte IV / nonce. */
  nonce: string;
  /** Payload format version. */
  version: 1;
}

export function generateAesGcmKey(): Uint8Array {
  return new Uint8Array(randomBytes(AES_GCM_KEY_BYTES));
}

export function keyToBase64(key: Uint8Array): string {
  return Buffer.from(key).toString("base64");
}

export function keyFromBase64(encoded: string): Uint8Array {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length !== AES_GCM_KEY_BYTES) {
    throw new Error(
      `AES-GCM key must be ${AES_GCM_KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  return new Uint8Array(buf);
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns base64 ciphertext + nonce.
 */
export function encryptAesGcm(
  plaintext: string,
  key: Uint8Array,
): AesGcmPayload {
  assertKey(key);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: iv.toString("base64"),
    version: 1,
  };
}

/**
 * Decrypt AES-256-GCM payload. Throws on auth failure / wrong key.
 */
export function decryptAesGcm(payload: AesGcmPayload, key: Uint8Array): string {
  assertKey(key);
  if (payload.version !== 1) {
    throw new Error(`Unsupported AES-GCM payload version: ${payload.version}`);
  }
  const iv = Buffer.from(payload.nonce, "base64");
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error(`AES-GCM nonce must be ${AES_GCM_IV_BYTES} bytes`);
  }
  const data = Buffer.from(payload.ciphertext, "base64");
  if (data.length < 16) {
    throw new Error("AES-GCM ciphertext too short");
  }
  const authTag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function assertKey(key: Uint8Array): void {
  if (key.length !== AES_GCM_KEY_BYTES) {
    throw new Error(
      `AES-GCM key must be ${AES_GCM_KEY_BYTES} bytes (got ${key.length})`,
    );
  }
}
