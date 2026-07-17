/**
 * Local vector helpers for sync semantic scoring (no @atlas-ai/ai dependency).
 * Algorithm matches MockEmbeddingProvider hashTextToVector.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
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

/**
 * Deterministic pseudo-embedding for offline semantic ranking.
 * Stable across runs; same algorithm as packages/ai MockEmbeddingProvider.
 */
export function hashTextToVector(text: string, dimensions: number): number[] {
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
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let th = 0;
    for (let i = 0; i < token.length; i++) {
      th = (th * 31 + token.charCodeAt(i)) >>> 0;
    }
    out[th % dims] = (out[th % dims]! + 0.35) % 1;
  }
  let norm = 0;
  for (const v of out) {
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => v / norm);
}
