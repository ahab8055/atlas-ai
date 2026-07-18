import type { EntityType } from "../types.js";

export interface ExtractionThresholds {
  /** Minimum confidence to keep a candidate (default 0.55). */
  minConfidence: number;
}

export const DEFAULT_EXTRACTION_THRESHOLDS: ExtractionThresholds = {
  minConfidence: 0.55,
};

export interface ExtractedEntityCandidate {
  type: EntityType;
  name: string;
  confidence: number;
  evidence: string;
  reasons: string[];
}

export interface ExtractEntitiesResult {
  candidates: ExtractedEntityCandidate[];
  discarded: Array<{ reason: string; text?: string }>;
}

export interface ExtractEntitiesOptions {
  thresholds?: Partial<ExtractionThresholds>;
  /** Optional application name from intent params. */
  applicationHint?: string;
  userId?: string;
}

export interface IngestOptions {
  thresholds?: Partial<ExtractionThresholds>;
  userId?: string;
  applicationHint?: string;
  now?: () => string;
  /** Auto-link co-mentioned entities (default true). */
  autoLinkOnExtract?: boolean;
  reinforceOnLink?: boolean;
  reinforceStep?: number;
}

export interface IngestedEntity {
  entity: import("../types.js").Entity;
  candidate: ExtractedEntityCandidate;
  created: boolean;
}

export interface ExtractAndStoreResult {
  candidates: ExtractedEntityCandidate[];
  stored: IngestedEntity[];
  skipped: ExtractedEntityCandidate[];
  linked: import("../relationships/types.js").LinkResult[];
}
