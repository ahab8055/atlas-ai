import { KnowledgeError } from "../errors.js";
import type { KnowledgeGraphManager } from "../manager.js";
import type { Entity } from "../types.js";
import { computeReinforce } from "./reinforce.js";
import type { LinkEntitiesInput, LinkEndpoint, LinkResult } from "./types.js";

function resolveEndpoint(
  graph: KnowledgeGraphManager,
  endpoint: LinkEndpoint,
  userId: string,
): Entity {
  if ("id" in endpoint && endpoint.id?.trim()) {
    const entity = graph.getEntity(endpoint.id.trim());
    if (!entity) {
      throw new KnowledgeError("not_found", `Entity not found: ${endpoint.id}`);
    }
    return entity;
  }
  if ("type" in endpoint && "name" in endpoint) {
    const entity = graph.findEntityByName(endpoint.type, endpoint.name, {
      userId,
    });
    if (!entity) {
      throw new KnowledgeError(
        "not_found",
        `Entity not found: ${endpoint.type}:${endpoint.name}`,
      );
    }
    return entity;
  }
  throw new KnowledgeError(
    "invalid_input",
    "Link endpoint requires id or type+name",
  );
}

/**
 * Create or reinforce a typed relationship between two entities.
 */
export function linkEntities(
  graph: KnowledgeGraphManager,
  input: LinkEntitiesInput,
): LinkResult {
  const userId = input.userId ?? "local";
  const now = input.now?.() ?? new Date().toISOString();
  const from = resolveEndpoint(graph, input.from, userId);
  const to = resolveEndpoint(graph, input.to, userId);

  if (from.id === to.id) {
    throw new KnowledgeError(
      "invalid_input",
      "Relationship endpoints must be distinct",
    );
  }

  const type = input.type?.trim();
  if (!type) {
    throw new KnowledgeError("invalid_input", "Relationship type is required");
  }

  const existing = graph
    .listRelationships({
      userId,
      fromEntityId: from.id,
      toEntityId: to.id,
      type,
      limit: 1,
    })
    .at(0);

  const state = computeReinforce(existing, {
    reinforce: input.reinforce,
    reinforceStep: input.reinforceStep,
    source: input.source,
    weight: input.weight,
    properties: input.properties,
    now,
  });

  const relationship = graph.upsertRelationship({
    id: existing?.id,
    userId,
    fromEntityId: from.id,
    toEntityId: to.id,
    type,
    weight: state.weight,
    properties: state.properties,
  });

  return {
    relationship,
    from,
    to,
    created: !existing,
    reinforced: Boolean(existing) && input.reinforce !== false,
  };
}
