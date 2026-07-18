import { describe, expect, it } from "vitest";

import { createInMemoryKnowledgeGraph } from "../manager.js";
import {
  KnowledgeRetrievalEngine,
  graphHopScore,
  lexicalEntityScore,
  tokenizeQuery,
} from "./index.js";

describe("KnowledgeRetrievalEngine", () => {
  it("scores lexical overlap and graph hops", () => {
    expect(
      lexicalEntityScore(
        {
          id: "1",
          userId: "local",
          type: "technology",
          name: "TypeScript",
          properties: {},
          createdAt: "",
          updatedAt: "",
        },
        tokenizeQuery("using TypeScript daily"),
      ),
    ).toBeGreaterThan(0.4);
    expect(graphHopScore(0, 0.5)).toBe(1);
    expect(graphHopScore(1, 0.8)).toBeCloseTo(0.4);
  });

  it("ranks seed entities above distant neighbors and respects minScore", () => {
    const graph = createInMemoryKnowledgeGraph();
    const project = graph.upsertEntity({ type: "project", name: "Atlas" });
    const tech = graph.upsertEntity({
      type: "technology",
      name: "TypeScript",
    });
    const distant = graph.upsertEntity({
      type: "technology",
      name: "ObscureLib",
    });
    graph.linkEntities({
      from: { id: project.id },
      to: { id: tech.id },
      type: "uses",
      weight: 0.9,
    });
    graph.linkEntities({
      from: { id: tech.id },
      to: { id: distant.id },
      type: "depends_on",
      weight: 0.3,
    });

    const engine = new KnowledgeRetrievalEngine(graph);
    const hits = engine.retrieve("Tell me about Atlas and TypeScript", {
      maxDepth: 2,
      minScore: 0.15,
      limit: 10,
    });

    expect(hits.some((h) => h.entity.name === "Atlas")).toBe(true);
    expect(hits.some((h) => h.entity.name === "TypeScript")).toBe(true);
    const atlas = hits.find((h) => h.entity.name === "Atlas")!;
    const obscure = hits.find((h) => h.entity.name === "ObscureLib");
    if (obscure) {
      expect(atlas.score).toBeGreaterThanOrEqual(obscure.score);
    }
    expect(hits.every((h) => h.score >= 0.15)).toBe(true);
    expect(hits[0]?.score).toBeGreaterThanOrEqual(hits.at(-1)!.score);
  });

  it("createRetriever returns scored snippets", () => {
    const graph = createInMemoryKnowledgeGraph();
    graph.upsertEntity({ type: "project", name: "Atlas" });
    graph.upsertEntity({ type: "technology", name: "React" });
    graph.linkEntities({
      from: { type: "project", name: "Atlas" },
      to: { type: "technology", name: "React" },
      type: "uses",
      weight: 0.85,
    });

    const retrieve = graph.createRetriever({ maxDepth: 1, minScore: 0.1 });
    const snippets = retrieve({
      sessionId: "s1",
      text: "How is Atlas structured with React?",
      intentName: "query",
    });
    expect(snippets.length).toBeGreaterThanOrEqual(1);
    expect(snippets.some((s) => s.label === "Atlas")).toBe(true);
    expect(snippets[0]?.score).toBeTypeOf("number");
  });
});
