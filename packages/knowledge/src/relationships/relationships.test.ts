import { describe, expect, it } from "vitest";

import { createInMemoryKnowledgeGraph } from "../manager.js";
import { linkCoMentions, linkEntities } from "./index.js";

describe("relationship management", () => {
  it("creates multiple relationship types between the same pair", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({ type: "technology", name: "TypeScript" });

    const uses = linkEntities(graph, {
      from: { id: project.id },
      to: { id: tech.id },
      type: "uses",
      source: "manual",
    });
    const related = linkEntities(graph, {
      from: { id: project.id },
      to: { id: tech.id },
      type: "depends_on",
      source: "manual",
    });

    expect(uses.created).toBe(true);
    expect(related.created).toBe(true);
    expect(graph.listRelationships({ fromEntityId: project.id })).toHaveLength(
      2,
    );
  });

  it("reinforces weight and seenCount on re-link", () => {
    const graph = createInMemoryKnowledgeGraph();
    const a = graph.upsertEntity({ type: "person", name: "Alice" });
    const b = graph.upsertEntity({ type: "company", name: "Acme" });

    const first = linkEntities(graph, {
      from: { id: a.id },
      to: { id: b.id },
      type: "related_to",
      reinforceStep: 0.05,
    });
    expect(first.created).toBe(true);
    expect(first.relationship.weight).toBe(0.5);
    expect(first.relationship.properties.seenCount).toBe(1);

    const second = linkEntities(graph, {
      from: { id: a.id },
      to: { id: b.id },
      type: "related_to",
      reinforceStep: 0.05,
    });
    expect(second.created).toBe(false);
    expect(second.reinforced).toBe(true);
    expect(second.relationship.weight).toBeCloseTo(0.55);
    expect(second.relationship.properties.seenCount).toBe(2);
    expect(second.relationship.id).toBe(first.relationship.id);
  });

  it("resolves endpoints by type+name", () => {
    const graph = createInMemoryKnowledgeGraph();
    graph.upsertEntity({ type: "project", name: "Atlas" });
    graph.upsertEntity({ type: "technology", name: "React" });

    const linked = linkEntities(graph, {
      from: { type: "project", name: "atlas" },
      to: { type: "technology", name: "React" },
      type: "uses",
    });
    expect(linked.relationship.type).toBe("uses");
  });

  it("auto-links co-mentioned entities with typed edges", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({ type: "technology", name: "TypeScript" });
    const person = graph.upsertEntity({ type: "person", name: "Alice" });
    const loc = graph.upsertEntity({ type: "location", name: "SF" });

    const linked = linkCoMentions(graph, [project, tech, person, loc]);
    expect(linked.length).toBeGreaterThanOrEqual(2);

    const uses = graph.listRelationships({
      fromEntityId: project.id,
      type: "uses",
    });
    expect(uses.some((r) => r.toEntityId === tech.id)).toBe(true);

    const located = graph.listRelationships({ type: "located_at" });
    expect(located.some((r) => r.toEntityId === loc.id)).toBe(true);
  });

  it("traverses with relation type filter efficiently", () => {
    const graph = createInMemoryKnowledgeGraph();
    const a = graph.upsertEntity({ type: "project", name: "A" });
    const b = graph.upsertEntity({ type: "technology", name: "B" });
    const c = graph.upsertEntity({ type: "technology", name: "C" });
    linkEntities(graph, {
      from: { id: a.id },
      to: { id: b.id },
      type: "uses",
    });
    linkEntities(graph, {
      from: { id: a.id },
      to: { id: c.id },
      type: "related_to",
    });
    linkEntities(graph, {
      from: { id: b.id },
      to: { id: c.id },
      type: "depends_on",
    });

    const filtered = graph.traverse({
      startId: a.id,
      maxDepth: 2,
      direction: "out",
      relationTypes: ["uses"],
    });
    expect(filtered.relationships.every((r) => r.type === "uses")).toBe(true);
    expect(filtered.entities.map((e) => e.name).sort()).toEqual(["A", "B"]);
  });
});
