import type { KnowledgeGraphManager } from "./manager.js";
import type {
  Entity,
  KnowledgeSnippetView,
  Relationship,
  TraverseResult,
} from "./types.js";

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

export interface LexicalKnowledgeRetrieverOptions {
  maxDepth?: number;
  limit?: number;
  userId?: string;
}

/**
 * Lexical name match on request text → shallow ego neighborhood → snippets.
 */
export function createLexicalKnowledgeRetriever(
  graph: KnowledgeGraphManager,
  options: LexicalKnowledgeRetrieverOptions = {},
): (input: {
  sessionId: string;
  text: string;
  intentName: string;
}) => KnowledgeSnippetView[] {
  const maxDepth = options.maxDepth ?? 1;
  const limit = Math.max(1, options.limit ?? 12);
  const userId = options.userId ?? "local";

  return ({ text }) => {
    const hay = text.trim().toLowerCase();
    if (!hay) {
      return [];
    }

    const candidates = graph.listEntities({ userId, limit: 200 });
    const matched = candidates.filter((e) => {
      const name = e.name.toLowerCase();
      return (
        hay.includes(name) ||
        name.split(/\s+/).some((t) => t.length > 2 && hay.includes(t))
      );
    });

    if (matched.length === 0) {
      return [];
    }

    const byId = new Map<string, Entity>();
    const edgeIds = new Set<string>();
    const relationships: Relationship[] = [];

    for (const entity of matched.slice(0, 5)) {
      byId.set(entity.id, entity);
      try {
        const hops = graph.traverse({
          startId: entity.id,
          maxDepth,
          userId,
          limit,
        });
        for (const e of hops.entities) {
          byId.set(e.id, e);
        }
        for (const r of hops.relationships) {
          if (!edgeIds.has(r.id)) {
            edgeIds.add(r.id);
            relationships.push(r);
          }
        }
      } catch {
        // skip missing / invalid
      }
    }

    void relationships;
    return toKnowledgeSnippets([...byId.values()]).slice(0, limit);
  };
}
