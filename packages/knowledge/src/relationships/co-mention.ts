import type { KnowledgeGraphManager } from "../manager.js";
import type { Entity, EntityType, RelationshipType } from "../types.js";
import { linkEntities } from "./link.js";
import type { CoMentionOptions, LinkResult } from "./types.js";

interface PairRule {
  left: EntityType;
  right: EntityType;
  type: RelationshipType;
  /** When true, edge goes left → right; otherwise either order. */
  directed?: boolean;
}

const TYPED_RULES: PairRule[] = [
  { left: "project", right: "technology", type: "uses", directed: true },
  { left: "project", right: "application", type: "uses", directed: true },
  { left: "person", right: "company", type: "related_to" },
  { left: "person", right: "project", type: "related_to" },
];

function pairKey(a: string, b: string, type: string): string {
  return `${type}:${[a, b].sort().join("|")}`;
}

/**
 * Link entities co-mentioned in one extraction pass using typed heuristics.
 */
export function linkCoMentions(
  graph: KnowledgeGraphManager,
  entities: Entity[],
  options: CoMentionOptions = {},
): LinkResult[] {
  if (options.enabled === false || entities.length < 2) {
    return [];
  }

  const userId = options.userId ?? "local";
  const maxPairs = Math.max(1, options.maxPairs ?? 6);
  const results: LinkResult[] = [];
  const seen = new Set<string>();

  const byType = new Map<EntityType, Entity[]>();
  for (const entity of entities) {
    const list = byType.get(entity.type as EntityType) ?? [];
    list.push(entity);
    byType.set(entity.type as EntityType, list);
  }

  const tryLink = (from: Entity, to: Entity, type: RelationshipType): void => {
    if (from.id === to.id) {
      return;
    }
    const key = pairKey(from.id, to.id, type);
    if (seen.has(key)) {
      return;
    }
    if (results.length >= maxPairs) {
      return;
    }
    seen.add(key);
    results.push(
      linkEntities(graph, {
        from: { id: from.id },
        to: { id: to.id },
        type,
        source: "co_mention",
        userId,
        reinforce: options.reinforce,
        reinforceStep: options.reinforceStep,
        now: options.now,
      }),
    );
  };

  for (const rule of TYPED_RULES) {
    const lefts = byType.get(rule.left) ?? [];
    const rights = byType.get(rule.right) ?? [];
    for (const left of lefts) {
      for (const right of rights) {
        if (rule.directed) {
          tryLink(left, right, rule.type);
        } else {
          tryLink(left, right, rule.type);
        }
      }
    }
  }

  // entity → location as located_at
  const locations = byType.get("location") ?? [];
  if (locations.length > 0) {
    for (const entity of entities) {
      if (entity.type === "location") {
        continue;
      }
      for (const loc of locations) {
        tryLink(entity, loc, "located_at");
      }
    }
  }

  // Fallback related_to for remaining co-mentions
  if (results.length < maxPairs) {
    for (let i = 0; i < entities.length; i += 1) {
      for (let j = i + 1; j < entities.length; j += 1) {
        const a = entities[i]!;
        const b = entities[j]!;
        const key = pairKey(a.id, b.id, "related_to");
        if (seen.has(key)) {
          continue;
        }
        // Prefer a→b alphabetical by id for stability
        const [from, to] = a.id < b.id ? [a, b] : [b, a];
        tryLink(from, to, "related_to");
        if (results.length >= maxPairs) {
          return results;
        }
      }
    }
  }

  return results;
}
