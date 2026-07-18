import { randomUUID } from "node:crypto";

import { KnowledgeError } from "../errors.js";
import type { GraphStore } from "../store.js";
import type {
  CreateEntityInput,
  CreateRelationshipInput,
  Entity,
  EntityQuery,
  NeighborHit,
  NeighborOptions,
  Relationship,
  RelationshipQuery,
  UpdateEntityInput,
  UpdateRelationshipInput,
} from "../types.js";

function normalizeWeight(weight: number | undefined): number | undefined {
  if (weight === undefined) {
    return undefined;
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new KnowledgeError(
      "invalid_input",
      "Relationship weight must be between 0 and 1",
    );
  }
  return weight;
}

/**
 * Map-backed graph store for unit tests.
 */
export class InMemoryGraphStore implements GraphStore {
  private readonly entities = new Map<string, Entity>();
  private readonly relationships = new Map<string, Relationship>();

  upsertEntity(input: CreateEntityInput): Entity {
    const type = input.type?.trim();
    const name = input.name?.trim();
    if (!type || !name) {
      throw new KnowledgeError(
        "invalid_input",
        "Entity type and name are required",
      );
    }
    const userId = input.userId?.trim() || "local";
    const now = new Date().toISOString();

    let existing: Entity | undefined;
    if (input.id?.trim()) {
      existing = this.entities.get(input.id.trim());
    } else {
      existing = [...this.entities.values()].find(
        (e) => e.userId === userId && e.type === type && e.name === name,
      );
    }

    const id = existing?.id ?? input.id?.trim() ?? randomUUID();
    const entity: Entity = {
      id,
      userId,
      type,
      name,
      properties: { ...(input.properties ?? existing?.properties ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  updateEntity(id: string, patch: UpdateEntityInput): Entity {
    const existing = this.entities.get(id);
    if (!existing) {
      throw new KnowledgeError("not_found", `Entity not found: ${id}`);
    }
    const type = patch.type !== undefined ? patch.type.trim() : existing.type;
    const name = patch.name !== undefined ? patch.name.trim() : existing.name;
    if (!type || !name) {
      throw new KnowledgeError(
        "invalid_input",
        "Entity type and name are required",
      );
    }
    const updated: Entity = {
      ...existing,
      type,
      name,
      properties:
        patch.properties !== undefined
          ? { ...patch.properties }
          : existing.properties,
      updatedAt: new Date().toISOString(),
    };
    this.entities.set(id, updated);
    return updated;
  }

  deleteEntity(id: string): boolean {
    if (!this.entities.delete(id)) {
      return false;
    }
    for (const [relId, rel] of this.relationships) {
      if (rel.fromEntityId === id || rel.toEntityId === id) {
        this.relationships.delete(relId);
      }
    }
    return true;
  }

  listEntities(query: EntityQuery = {}): Entity[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 100);
    const nameFilter = query.name?.trim().toLowerCase();
    let rows = [...this.entities.values()].filter((e) => e.userId === userId);
    if (query.type) {
      rows = rows.filter((e) => e.type === query.type);
    }
    if (nameFilter) {
      rows = rows.filter((e) => e.name.toLowerCase().includes(nameFilter));
    }
    return rows
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  upsertRelationship(input: CreateRelationshipInput): Relationship {
    const type = input.type?.trim();
    const fromEntityId = input.fromEntityId?.trim();
    const toEntityId = input.toEntityId?.trim();
    if (!type || !fromEntityId || !toEntityId) {
      throw new KnowledgeError(
        "invalid_input",
        "Relationship type and endpoints are required",
      );
    }
    if (fromEntityId === toEntityId) {
      throw new KnowledgeError(
        "invalid_input",
        "Relationship endpoints must be distinct",
      );
    }
    const from = this.entities.get(fromEntityId);
    const to = this.entities.get(toEntityId);
    if (!from || !to) {
      throw new KnowledgeError(
        "missing_endpoint",
        "Relationship endpoints must reference existing entities",
      );
    }

    const userId = input.userId?.trim() || from.userId || "local";
    const now = new Date().toISOString();
    let existing: Relationship | undefined;
    if (input.id?.trim()) {
      existing = this.relationships.get(input.id.trim());
    } else {
      existing = [...this.relationships.values()].find(
        (r) =>
          r.userId === userId &&
          r.fromEntityId === fromEntityId &&
          r.toEntityId === toEntityId &&
          r.type === type,
      );
    }

    const id = existing?.id ?? input.id?.trim() ?? randomUUID();
    const weight =
      input.weight !== undefined
        ? normalizeWeight(input.weight)
        : existing?.weight;
    const relationship: Relationship = {
      id,
      userId,
      fromEntityId,
      toEntityId,
      type,
      weight,
      properties: { ...(input.properties ?? existing?.properties ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.relationships.set(id, relationship);
    return relationship;
  }

  getRelationship(id: string): Relationship | undefined {
    return this.relationships.get(id);
  }

  updateRelationship(id: string, patch: UpdateRelationshipInput): Relationship {
    const existing = this.relationships.get(id);
    if (!existing) {
      throw new KnowledgeError("not_found", `Relationship not found: ${id}`);
    }
    const type = patch.type !== undefined ? patch.type.trim() : existing.type;
    if (!type) {
      throw new KnowledgeError(
        "invalid_input",
        "Relationship type is required",
      );
    }
    let weight = existing.weight;
    if (patch.weight === null) {
      weight = undefined;
    } else if (patch.weight !== undefined) {
      weight = normalizeWeight(patch.weight);
    }
    const updated: Relationship = {
      ...existing,
      type,
      weight,
      properties:
        patch.properties !== undefined
          ? { ...patch.properties }
          : existing.properties,
      updatedAt: new Date().toISOString(),
    };
    this.relationships.set(id, updated);
    return updated;
  }

  deleteRelationship(id: string): boolean {
    return this.relationships.delete(id);
  }

  listRelationships(query: RelationshipQuery = {}): Relationship[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 200);
    let rows = [...this.relationships.values()].filter(
      (r) => r.userId === userId,
    );
    if (query.fromEntityId) {
      rows = rows.filter((r) => r.fromEntityId === query.fromEntityId);
    }
    if (query.toEntityId) {
      rows = rows.filter((r) => r.toEntityId === query.toEntityId);
    }
    if (query.type) {
      rows = rows.filter((r) => r.type === query.type);
    } else if (query.types && query.types.length > 0) {
      const allowed = new Set(query.types);
      rows = rows.filter((r) => allowed.has(r.type));
    }
    return rows
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  neighbors(entityId: string, options: NeighborOptions = {}): NeighborHit[] {
    const userId = options.userId ?? "local";
    const direction = options.direction ?? "both";
    const limit = Math.max(1, options.limit ?? 100);
    const hits: NeighborHit[] = [];

    const typeOk = (type: string): boolean => {
      if (!options.types || options.types.length === 0) {
        return true;
      }
      return options.types.includes(type);
    };

    for (const relationship of this.relationships.values()) {
      if (relationship.userId !== userId) {
        continue;
      }
      if (!typeOk(relationship.type)) {
        continue;
      }
      if (
        (direction === "out" || direction === "both") &&
        relationship.fromEntityId === entityId
      ) {
        hits.push({
          relationship,
          entityId: relationship.toEntityId,
          entity: this.entities.get(relationship.toEntityId),
        });
      }
      if (
        (direction === "in" || direction === "both") &&
        relationship.toEntityId === entityId
      ) {
        hits.push({
          relationship,
          entityId: relationship.fromEntityId,
          entity: this.entities.get(relationship.fromEntityId),
        });
      }
    }
    return hits.slice(0, limit);
  }
}

export function createInMemoryGraphStore(): InMemoryGraphStore {
  return new InMemoryGraphStore();
}
