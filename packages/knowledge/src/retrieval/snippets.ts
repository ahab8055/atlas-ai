import type { KnowledgeSnippetView } from "../types.js";
import type { RetrievedEntity } from "./types.js";

export function retrievedToSnippet(hit: RetrievedEntity): KnowledgeSnippetView {
  const base =
    hit.hop > 0 && hit.via && hit.viaFrom
      ? `${hit.entity.type}: ${hit.entity.name} (via ${hit.via.type}←${hit.viaFrom.name})`
      : `${hit.entity.type}: ${hit.entity.name}`;
  return {
    id: hit.entity.id,
    label: hit.entity.name,
    content: base,
    score: hit.score,
  };
}

export function toRankedKnowledgeSnippets(
  hits: RetrievedEntity[],
): KnowledgeSnippetView[] {
  return hits.map(retrievedToSnippet);
}
