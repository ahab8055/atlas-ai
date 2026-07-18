/**
 * Passphrase-encrypted memory backup envelope (ADR-0057).
 */
import { randomBytes, scryptSync } from "node:crypto";

import { decryptAesGcm, encryptAesGcm } from "@atlas-ai/security";

import {
  MEMORY_BACKUP_ENCRYPTED_FORMAT,
  MEMORY_BACKUP_VERSION,
  type MemoryBackupEnvelope,
  type MemoryBackupSnapshot,
} from "./types.js";
import { validateSnapshot } from "./snapshot.js";

const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_BYTES = 16;
/** Node scrypt defaults tuned for interactive backup encrypt (N=2^14). */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
): Uint8Array {
  if (!passphrase) {
    throw new Error("Backup passphrase is required");
  }
  return new Uint8Array(
    scryptSync(passphrase, Buffer.from(salt), SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 64 * 1024 * 1024,
    }),
  );
}

export function encryptBackup(
  snapshot: MemoryBackupSnapshot,
  passphrase: string,
): MemoryBackupEnvelope {
  const salt = new Uint8Array(randomBytes(SCRYPT_SALT_BYTES));
  const key = deriveBackupKey(passphrase, salt);
  const plaintext = JSON.stringify(snapshot);
  const payload = encryptAesGcm(plaintext, key);
  return {
    format: MEMORY_BACKUP_ENCRYPTED_FORMAT,
    version: MEMORY_BACKUP_VERSION,
    kdf: "scrypt",
    salt: Buffer.from(salt).toString("base64"),
    nonce: payload.nonce,
    ciphertext: payload.ciphertext,
  };
}

export function decryptBackup(
  envelope: MemoryBackupEnvelope,
  passphrase: string,
): MemoryBackupSnapshot {
  if (envelope.format !== MEMORY_BACKUP_ENCRYPTED_FORMAT) {
    throw new Error(`Invalid encrypted backup format: ${envelope.format}`);
  }
  if (envelope.version !== MEMORY_BACKUP_VERSION) {
    throw new Error(
      `Unsupported encrypted backup version: ${envelope.version}`,
    );
  }
  if (envelope.kdf !== "scrypt") {
    throw new Error(`Unsupported KDF: ${envelope.kdf}`);
  }
  const salt = new Uint8Array(Buffer.from(envelope.salt, "base64"));
  const key = deriveBackupKey(passphrase, salt);
  const plaintext = decryptAesGcm(
    {
      ciphertext: envelope.ciphertext,
      nonce: envelope.nonce,
      version: 1,
    },
    key,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext) as unknown;
  } catch {
    throw new Error("Decrypted backup is not valid JSON");
  }
  const validated = validateSnapshot(parsed);
  if (!validated.ok || !validated.snapshot) {
    throw new Error(
      `Decrypted backup failed validation: ${validated.errors.join("; ")}`,
    );
  }
  return validated.snapshot;
}

export function isBackupEnvelope(
  input: unknown,
): input is MemoryBackupEnvelope {
  return (
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as MemoryBackupEnvelope).format === MEMORY_BACKUP_ENCRYPTED_FORMAT
  );
}

export function parseBackupJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Backup file is not valid JSON");
  }
}
