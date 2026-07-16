/**
 * Vector helpers for embedding storage and future retrieval.
 */
import type { EmbeddingVector } from "./types.js";

export function assertValidVector(
  vector: EmbeddingVector,
  label = "embedding",
): void {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(`${label} must be a non-empty number array`);
  }
  for (const v of vector) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`${label} contains non-finite values`);
    }
  }
}

export function cosineSimilarity(
  a: EmbeddingVector,
  b: EmbeddingVector,
): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Pack float32 LE for SQLite BLOB storage. */
export function serializeEmbedding(vector: EmbeddingVector): Buffer {
  assertValidVector(vector);
  const buf = Buffer.allocUnsafe(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buf.writeFloatLE(vector[i]!, i * 4);
  }
  return buf;
}

export function deserializeEmbedding(
  blob: Buffer | Uint8Array,
): EmbeddingVector {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < 4 || buf.length % 4 !== 0) {
    throw new Error("Invalid embedding blob length");
  }
  const n = buf.length / 4;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = buf.readFloatLE(i * 4);
  }
  return out;
}

/**
 * Deterministic pseudo-embedding for offline/CI mock provider.
 * Not semantically meaningful — stable for tests and plumbing.
 */
export function hashTextToVector(
  text: string,
  dimensions: number,
): EmbeddingVector {
  const dims = Math.max(8, Math.floor(dimensions));
  const out = new Array<number>(dims).fill(0);
  const normalized = text.normalize("NFKC").trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
    const idx = (h >>> 0) % dims;
    out[idx] = (out[idx]! + ((h & 0xff) / 127.5 - 1)) / 2;
  }
  // Mix token-ish buckets
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let th = 0;
    for (let i = 0; i < token.length; i++) {
      th = (th * 31 + token.charCodeAt(i)) >>> 0;
    }
    out[th % dims] = (out[th % dims]! + 0.35) % 1;
  }
  // L2 normalize
  let norm = 0;
  for (const v of out) {
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}
