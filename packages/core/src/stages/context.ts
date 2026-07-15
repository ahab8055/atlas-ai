import type {
  DetectedIntent,
  LoadedContext,
  NormalizedRequest,
} from "../types.js";

/**
 * Context loading stub — memory / history packages will fill this later.
 */
export function loadContext(
  request: NormalizedRequest,
  intent: DetectedIntent,
): LoadedContext {
  return {
    conversationSummary: `Session ${request.sessionId}; last intent ${intent.name}`,
    memories: [],
    systemState: {
      runtime: "atlas-core",
      source: request.source,
    },
  };
}
