import type {
  Entity,
  EntityType,
  Relationship,
  RelationshipType,
} from "../types.js";

export type LinkEndpoint = { id: string } | { type: EntityType; name: string };

export type LinkSource = "manual" | "extraction" | "co_mention";

export interface ReinforceOptions {
  /** When true, bump weight/seenCount on existing edges (default true). */
  reinforce?: boolean;
  /** Weight increment per reinforce (default 0.05). */
  reinforceStep?: number;
}

export interface LinkEntitiesInput extends ReinforceOptions {
  from: LinkEndpoint;
  to: LinkEndpoint;
  type: RelationshipType;
  weight?: number;
  properties?: Record<string, unknown>;
  source?: LinkSource;
  userId?: string;
  now?: () => string;
}

export interface LinkResult {
  relationship: Relationship;
  from: Entity;
  to: Entity;
  created: boolean;
  reinforced: boolean;
}

export interface CoMentionOptions extends ReinforceOptions {
  userId?: string;
  /** Max related_to fallback pairs (default 6). */
  maxPairs?: number;
  now?: () => string;
  /** When false, skip auto-link (default true). */
  enabled?: boolean;
}

export const DEFAULT_REINFORCE_STEP = 0.05;
