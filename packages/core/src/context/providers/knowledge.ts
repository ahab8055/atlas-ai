import type {
  ContextContribution,
  ContextProvider,
  KnowledgeSnippet,
} from "../types.js";

/**
 * Knowledge graph provider port — swap for graph retrieval later.
 */
export type KnowledgeRetriever = (input: {
  sessionId: string;
  text: string;
  intentName: string;
}) => KnowledgeSnippet[];

export function createKnowledgeProvider(
  retrieve: KnowledgeRetriever = () => [],
): ContextProvider {
  return {
    id: "knowledge",
    load({ request, intent }) {
      const knowledge = retrieve({
        sessionId: request.sessionId,
        text: request.text,
        intentName: intent.name,
      });
      return {
        source: "knowledge",
        knowledge,
      } satisfies ContextContribution;
    },
  };
}
