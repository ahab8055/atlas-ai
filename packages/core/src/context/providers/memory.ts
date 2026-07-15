import type {
  ContextContribution,
  ContextProvider,
  MemorySnippet,
} from "../types.js";

/**
 * Memory provider port — swap for `@atlas-ai/memory` retrieval later.
 * Default returns empty; optional injector used in tests / early wiring.
 */
export type MemoryRetriever = (input: {
  sessionId: string;
  text: string;
  intentName: string;
}) => MemorySnippet[];

export function createMemoryProvider(
  retrieve: MemoryRetriever = () => [],
): ContextProvider {
  return {
    id: "memory",
    load({ request, intent }) {
      const memories = retrieve({
        sessionId: request.sessionId,
        text: request.text,
        intentName: intent.name,
      });
      return {
        source: "memory",
        memories,
      } satisfies ContextContribution;
    },
  };
}
