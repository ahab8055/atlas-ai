import type { KnowledgeGraphManager } from "./manager.js";
import {
  KnowledgeRetrievalEngine,
  toRankedKnowledgeSnippets,
  type KnowledgeRetrievalOptions,
} from "./retrieval/index.js";
import type { Entity, KnowledgeSnippetView, TraverseResult } from "./types.js";

function summarizeProperties(properties: Record<string, unknown>): string {
  const entries = Object.entries(properties).slice(0, 4);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
}

/** Map an entity to a core-compatible knowledge snippet. */
export function entityToSnippet(entity: Entity): KnowledgeSnippetView {
  const props = summarizeProperties(entity.properties);
  const content = props
    ? `${entity.type}: ${entity.name} (${props})`
    : `${entity.type}: ${entity.name}`;
  return {
    id: entity.id,
    label: entity.name,
    content,
  };
}

export function toKnowledgeSnippets(
  entities: Entity[],
): KnowledgeSnippetView[] {
  return entities.map(entityToSnippet);
}

export function traverseToSnippets(
  result: TraverseResult,
): KnowledgeSnippetView[] {
  return toKnowledgeSnippets(result.entities);
}

export type KnowledgeRetrieverOptions = KnowledgeRetrievalOptions;

/**
 * Ranked knowledge retriever for context providers (ADR-0049).
 * Lexical seed match → neighbor expand → score → top-K snippets.
 */
export function createKnowledgeRetriever(
  graph: KnowledgeGraphManager,
  options: KnowledgeRetrieverOptions = {},
): (input: {
  sessionId: string;
  text: string;
  intentName: string;
}) => KnowledgeSnippetView[] {
  const engine = new KnowledgeRetrievalEngine(graph);
  return ({ text }) =>
    toRankedKnowledgeSnippets(engine.retrieve(text, options));
}

/**
 * @deprecated Prefer {@link createKnowledgeRetriever}. Alias for back-compat.
 */
export function createLexicalKnowledgeRetriever(
  graph: KnowledgeGraphManager,
  options: KnowledgeRetrieverOptions = {},
): (input: {
  sessionId: string;
  text: string;
  intentName: string;
}) => KnowledgeSnippetView[] {
  return createKnowledgeRetriever(graph, {
    ...options,
    maxDepth: options.maxDepth ?? 1,
  });
}
