import type { Entity, GraphSnapshot, Relationship } from "./types.js";

/** Build a viz-ready snapshot from entity/edge sets. */
export function toGraphSnapshot(
  entities: Entity[],
  relationships: Relationship[],
): GraphSnapshot {
  const nodes = entities.map((e) => ({
    id: e.id,
    label: e.name,
    type: e.type,
    properties: { ...e.properties },
  }));
  const edges = relationships.map((r) => ({
    id: r.id,
    source: r.fromEntityId,
    target: r.toEntityId,
    type: r.type,
    weight: r.weight,
    properties: { ...r.properties },
  }));
  return { nodes, edges };
}
