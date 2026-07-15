import {
  summarizeConversation,
  type ConversationStore,
} from "../conversation-store.js";
import type { ContextContribution, ContextProvider } from "../types.js";

export function createConversationProvider(
  store: ConversationStore,
): ContextProvider {
  return {
    id: "conversation",
    load({ request, intent }) {
      store.append(request.sessionId, {
        role: "user",
        text: request.text,
        intentName: intent.name,
        at: new Date().toISOString(),
      });

      const turns = store.getTurns(request.sessionId);
      const summary = summarizeConversation(request.sessionId, turns);

      return {
        source: "conversation",
        conversation: {
          sessionId: request.sessionId,
          turns,
          summary,
        },
      } satisfies ContextContribution;
    },
  };
}
