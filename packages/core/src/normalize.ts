import { randomUUID } from "node:crypto";

import type { IncomingRequest, NormalizedRequest } from "./types.js";

/**
 * Normalize adapter input into a canonical request.
 * Source-agnostic so CLI / desktop / voice share one shape.
 */
export function normalizeRequest(incoming: IncomingRequest): NormalizedRequest {
  const text = incoming.rawInput.trim().replace(/\s+/g, " ");
  const id = randomUUID();

  return {
    id,
    traceId: id,
    source: incoming.source,
    text,
    sessionId: incoming.sessionId?.trim() || "default",
    receivedAt: new Date().toISOString(),
    metadata: { ...(incoming.metadata ?? {}) },
  };
}
