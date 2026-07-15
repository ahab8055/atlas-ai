import type { DetectedIntent, NormalizedRequest } from "../types.js";

/**
 * Heuristic intent detection for Phase 1 (no LLM yet).
 * Future: replace with model-backed analyzer while keeping this return shape.
 */
export function detectIntent(request: NormalizedRequest): DetectedIntent {
  const text = request.text.toLowerCase();

  if (!text || text === "help" || text === "?" || text === "--help") {
    return {
      name: "help",
      confidence: 1,
      capabilities: [],
      complexity: "low",
    };
  }

  if (
    text === "status" ||
    text === "ping" ||
    text === "health" ||
    text.startsWith("status ")
  ) {
    return {
      name: "system.status",
      confidence: 0.95,
      capabilities: ["system.info"],
      complexity: "low",
    };
  }

  if (text === "echo" || text.startsWith("echo ")) {
    return {
      name: "echo",
      confidence: 0.9,
      capabilities: [],
      complexity: "low",
    };
  }

  return {
    name: "conversational.reply",
    confidence: 0.55,
    capabilities: [],
    complexity: "medium",
  };
}
