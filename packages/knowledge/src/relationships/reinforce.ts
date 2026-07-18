import type { Relationship } from "../types.js";
import { DEFAULT_REINFORCE_STEP } from "./types.js";

export interface ReinforceState {
  weight: number;
  seenCount: number;
  lastSeenAt: string;
  linkedAt: string;
  properties: Record<string, unknown>;
}

/**
 * Compute reinforced weight + metadata for an existing or new edge.
 */
export function computeReinforce(
  existing: Relationship | undefined,
  options: {
    reinforce?: boolean;
    reinforceStep?: number;
    source?: string;
    weight?: number;
    properties?: Record<string, unknown>;
    now: string;
  },
): ReinforceState {
  const reinforce = options.reinforce !== false;
  const step = options.reinforceStep ?? DEFAULT_REINFORCE_STEP;
  const prevCount =
    typeof existing?.properties.seenCount === "number"
      ? existing.properties.seenCount
      : existing
        ? 1
        : 0;
  const linkedAt =
    typeof existing?.properties.linkedAt === "string"
      ? existing.properties.linkedAt
      : options.now;

  let weight: number;
  if (options.weight !== undefined) {
    weight = options.weight;
  } else if (existing && reinforce) {
    weight = Math.min(1, (existing.weight ?? 0.5) + step);
  } else if (existing) {
    weight = existing.weight ?? 0.5;
  } else {
    weight = 0.5;
  }

  const seenCount =
    existing && reinforce ? prevCount + 1 : Math.max(1, prevCount || 1);

  return {
    weight,
    seenCount,
    lastSeenAt: options.now,
    linkedAt,
    properties: {
      ...(existing?.properties ?? {}),
      ...(options.properties ?? {}),
      source:
        options.source ??
        (typeof existing?.properties.source === "string"
          ? existing.properties.source
          : "manual"),
      seenCount,
      lastSeenAt: options.now,
      linkedAt,
    },
  };
}
