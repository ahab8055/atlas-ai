import type { KnowledgeGraphManager } from "../manager.js";
import type { Entity } from "../types.js";
import { extractEntities } from "./extract.js";
import { entityDedupeKey } from "./normalize.js";
import type {
  ExtractAndStoreResult,
  ExtractedEntityCandidate,
  IngestOptions,
  IngestedEntity,
} from "./types.js";
import { DEFAULT_EXTRACTION_THRESHOLDS } from "./types.js";

/**
 * Upsert extracted candidates onto the graph with extraction metadata.
 */
export function ingestExtractedEntities(
  graph: KnowledgeGraphManager,
  candidates: ExtractedEntityCandidate[],
  options: IngestOptions = {},
): IngestedEntity[] {
  const userId = options.userId ?? "local";
  const now = options.now?.() ?? new Date().toISOString();
  const stored: IngestedEntity[] = [];

  for (const candidate of candidates) {
    const before = graph.findEntityByName(candidate.type, candidate.name, {
      userId,
    });
    const entity = graph.upsertEntity({
      userId,
      type: candidate.type,
      name: candidate.name,
      properties: {
        source: "extraction",
        confidence: candidate.confidence,
        evidence: candidate.evidence,
        extractedAt: now,
        reasons: candidate.reasons,
      },
    });
    stored.push({
      entity,
      candidate,
      created: !before,
    });
  }

  return stored;
}

/**
 * Extract then store entities that pass the confidence gate.
 */
export function extractAndStoreEntities(
  graph: KnowledgeGraphManager,
  text: string,
  options: IngestOptions = {},
): ExtractAndStoreResult {
  const thresholds = {
    ...DEFAULT_EXTRACTION_THRESHOLDS,
    ...options.thresholds,
  };
  const { candidates } = extractEntities(text, {
    thresholds,
    applicationHint: options.applicationHint,
    userId: options.userId,
  });

  const kept: ExtractedEntityCandidate[] = [];
  const skipped: ExtractedEntityCandidate[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const key = entityDedupeKey(c.type, c.name);
    if (seen.has(key)) {
      skipped.push(c);
      continue;
    }
    seen.add(key);
    kept.push(c);
  }

  const stored = ingestExtractedEntities(graph, kept, options);
  return { candidates, stored, skipped };
}

export type { Entity };
