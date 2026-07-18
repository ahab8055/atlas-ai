import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import {
  createInMemoryKnowledgeGraph,
  createKnowledgeGraph,
  createSqliteGraphStore,
  extractEntities,
  entityDedupeKey,
  normalizeEntityName,
} from "../index.js";

describe("entity extraction", () => {
  it("normalizes names and builds dedupe keys", () => {
    expect(normalizeEntityName("  Type  Script  ")).toBe("Type Script");
    expect(entityDedupeKey("technology", "TypeScript")).toBe(
      entityDedupeKey("technology", "typescript"),
    );
  });

  it("extracts people, projects, companies, locations, files, tech, apps", () => {
    const text =
      "I talked to Alice about project Atlas at Acme Corp in San Francisco. " +
      "We are using TypeScript in src/app.ts and I open VS Code daily.";
    const { candidates } = extractEntities(text);
    const byType = (t: string) => candidates.filter((c) => c.type === t);

    expect(byType("person").some((c) => c.name === "Alice")).toBe(true);
    expect(byType("project").some((c) => /Atlas/i.test(c.name))).toBe(true);
    expect(byType("company").some((c) => /Acme/i.test(c.name))).toBe(true);
    expect(byType("location").some((c) => /San Francisco/i.test(c.name))).toBe(
      true,
    );
    expect(byType("file").some((c) => c.name === "app.ts")).toBe(true);
    expect(byType("technology").some((c) => c.name === "TypeScript")).toBe(
      true,
    );
    expect(byType("application").some((c) => /VS Code/i.test(c.name))).toBe(
      true,
    );
  });

  it("discards noise and respects minConfidence", () => {
    expect(extractEntities("hello").candidates).toHaveLength(0);
    expect(
      extractEntities("using XyzzyFramework", {
        thresholds: { minConfidence: 0.95 },
      }).candidates.every((c) => c.confidence >= 0.95),
    ).toBe(true);
  });

  it("dedupes case variants on store", () => {
    const graph = createInMemoryKnowledgeGraph();
    graph.upsertEntity({ type: "technology", name: "TypeScript" });
    graph.upsertEntity({ type: "technology", name: "typescript" });
    expect(graph.listEntities({ type: "technology" })).toHaveLength(1);
    expect(graph.findEntityByName("technology", "TYPESCRIPT")?.name).toBe(
      "TypeScript",
    );
  });

  it("extractAndStore writes metadata and skips duplicates", () => {
    const graph = createInMemoryKnowledgeGraph();
    const first = graph.extractAndStore(
      "Working on project Atlas with React and TypeScript",
    );
    expect(first.stored.length).toBeGreaterThanOrEqual(2);
    expect(first.stored[0]?.entity.properties.source).toBe("extraction");
    expect(first.stored[0]?.entity.properties.confidence).toBeTypeOf("number");

    const second = graph.extractAndStore(
      "project atlas uses typescript and react",
    );
    const techs = graph.listEntities({ type: "technology" });
    const projects = graph.listEntities({ type: "project" });
    expect(projects).toHaveLength(1);
    expect(techs.filter((t) => /typescript/i.test(t.name))).toHaveLength(1);
    expect(second.stored.every((s) => s.created === false || s.entity)).toBe(
      true,
    );
  });

  it("persists extracted entities via SQLite with case-insensitive dedupe", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const graph = createKnowledgeGraph(createSqliteGraphStore(db));
      graph.extractAndStore("I met Bob at Google using Python");
      graph.upsertEntity({ type: "person", name: "bob" });
      expect(graph.listEntities({ type: "person" })).toHaveLength(1);
      expect(graph.findEntityByName("person", "BOB")?.name).toBe("Bob");
    } finally {
      db.close();
    }
  });
});
