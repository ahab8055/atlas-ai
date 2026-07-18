import { openAtlasDatabase } from "@atlas-ai/database";
import { describe, expect, it } from "vitest";

import {
  createInMemoryKnowledgeGraph,
  createKnowledgeGraph,
  createLexicalKnowledgeRetriever,
  createSqliteGraphStore,
  toGraphSnapshot,
} from "./index.js";

describe("KnowledgeGraphManager", () => {
  it("stores entities and relationships consistently", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({
      type: "technology",
      name: "TypeScript",
    });
    const rel = graph.upsertRelationship({
      fromEntityId: project.id,
      toEntityId: tech.id,
      type: "uses",
      weight: 0.8,
    });

    expect(graph.getEntity(project.id)?.name).toBe("Atlas");
    expect(graph.getRelationship(rel.id)?.type).toBe("uses");
    expect(graph.listEntities({ type: "project" })).toHaveLength(1);

    // Upsert by key is idempotent
    const again = graph.upsertEntity({ type: "project", name: "Atlas" });
    expect(again.id).toBe(project.id);
  });

  it("rejects relationships without endpoints", () => {
    const graph = createInMemoryKnowledgeGraph();
    const a = graph.upsertEntity({ type: "concept", name: "A" });
    expect(() =>
      graph.upsertRelationship({
        fromEntityId: a.id,
        toEntityId: "missing",
        type: "related_to",
      }),
    ).toThrow(/endpoints/i);
  });

  it("traverses with depth limit and is cycle-safe", () => {
    const graph = createInMemoryKnowledgeGraph();
    const a = graph.upsertEntity({ type: "project", name: "A" });
    const b = graph.upsertEntity({ type: "technology", name: "B" });
    const c = graph.upsertEntity({ type: "technology", name: "C" });
    graph.upsertRelationship({
      fromEntityId: a.id,
      toEntityId: b.id,
      type: "uses",
    });
    graph.upsertRelationship({
      fromEntityId: b.id,
      toEntityId: c.id,
      type: "depends_on",
    });
    graph.upsertRelationship({
      fromEntityId: c.id,
      toEntityId: a.id,
      type: "related_to",
    });

    const depth1 = graph.traverse({
      startId: a.id,
      maxDepth: 1,
      direction: "out",
    });
    expect(depth1.entities.map((e) => e.name).sort()).toEqual(["A", "B"]);

    const depth2 = graph.traverse({
      startId: a.id,
      maxDepth: 2,
      direction: "out",
    });
    expect(depth2.entities).toHaveLength(3);
    expect(depth2.relationships.length).toBeGreaterThanOrEqual(2);

    // Cycle-safe with both directions
    const both = graph.traverse({
      startId: a.id,
      maxDepth: 5,
      direction: "both",
    });
    expect(both.entities).toHaveLength(3);
  });

  it("exports viz-ready GraphSnapshot", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({ type: "technology", name: "React" });
    graph.upsertRelationship({
      fromEntityId: project.id,
      toEntityId: tech.id,
      type: "uses",
    });

    const snap = graph.exportSnapshot({ startId: project.id, maxDepth: 1 });
    expect(snap.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: project.id,
          label: "Atlas",
          type: "project",
        }),
        expect.objectContaining({ label: "React", type: "technology" }),
      ]),
    );
    expect(snap.edges[0]).toEqual(
      expect.objectContaining({
        source: project.id,
        target: tech.id,
        type: "uses",
      }),
    );

    const full = toGraphSnapshot(
      graph.listEntities(),
      graph.listRelationships(),
    );
    expect(full.nodes).toHaveLength(2);
  });

  it("persists via SQLite store", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const graph = createKnowledgeGraph(createSqliteGraphStore(db));
      const project = graph.upsertEntity({
        type: "project",
        name: "Atlas",
        properties: { lang: "ts" },
      });
      const tech = graph.upsertEntity({
        type: "technology",
        name: "Vite",
      });
      graph.upsertRelationship({
        fromEntityId: project.id,
        toEntityId: tech.id,
        type: "uses",
      });

      const neighbors = graph.getNeighbors(project.id, { direction: "out" });
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0]?.entity?.name).toBe("Vite");

      expect(graph.deleteEntity(project.id)).toBe(true);
      expect(graph.listRelationships()).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it("builds lexical knowledge snippets from request text", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({
      type: "technology",
      name: "TypeScript",
    });
    graph.upsertRelationship({
      fromEntityId: project.id,
      toEntityId: tech.id,
      type: "uses",
    });

    const retrieve = createLexicalKnowledgeRetriever(graph, { maxDepth: 1 });
    const snippets = retrieve({
      sessionId: "s1",
      text: "Tell me about Atlas project setup",
      intentName: "query",
    });
    expect(snippets.some((s) => s.label === "Atlas")).toBe(true);
    expect(snippets.some((s) => s.label === "TypeScript")).toBe(true);
  });
});
