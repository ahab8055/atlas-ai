import type {
  DetectedIntent,
  IntentDefinition,
  IntentMatchResult,
} from "./types.js";

export interface RankedMatch {
  definition: IntentDefinition;
  match: IntentMatchResult;
}

/**
 * Ordered registry of intent definitions.
 * Supports adding / replacing intents at runtime for extensibility.
 */
export class IntentRegistry {
  private readonly definitions = new Map<string, IntentDefinition>();

  constructor(initial: readonly IntentDefinition[] = []) {
    for (const definition of initial) {
      this.register(definition);
    }
  }

  register(definition: IntentDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  unregister(name: string): boolean {
    return this.definitions.delete(name);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  list(): IntentDefinition[] {
    return [...this.definitions.values()].sort(
      (a, b) => b.priority - a.priority || a.name.localeCompare(b.name),
    );
  }

  /**
   * Evaluate all matchers; return the highest confidence × priority winner.
   */
  matchBest(normalizedText: string, originalText: string): RankedMatch | null {
    let best: RankedMatch | null = null;
    let bestScore = -1;

    for (const definition of this.list()) {
      const match = definition.match(normalizedText, originalText);
      if (!match) {
        continue;
      }
      // Priority is a tie-break / slight boost; confidence dominates.
      const score = match.confidence * 100 + definition.priority;
      if (score > bestScore) {
        bestScore = score;
        best = { definition, match };
      }
    }

    return best;
  }
}

export function toDetectedIntent(
  definition: IntentDefinition,
  match: IntentMatchResult,
): DetectedIntent {
  return {
    name: definition.name,
    category: definition.category,
    goal: match.goal ?? definition.goal,
    parameters: { ...match.parameters },
    confidence: match.confidence,
    capabilities: [...definition.capabilities],
    complexity: definition.complexity,
    known: true,
  };
}

export function unknownIntent(originalText: string): DetectedIntent {
  return {
    name: "unknown",
    category: "unknown",
    goal: "Unrecognized request",
    parameters: { text: originalText },
    confidence: 0.2,
    capabilities: [],
    complexity: "low",
    known: false,
  };
}
