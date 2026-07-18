import { describe, expect, it } from "vitest";

import {
  ContextManager,
  createKnowledgeProvider,
  detectIntent,
  loadContext,
  normalizeRequest,
} from "@atlas-ai/core";
import { openAtlasDatabase } from "@atlas-ai/database";
import {
  createKnowledgeGraph,
  createSqliteGraphStore,
} from "@atlas-ai/knowledge";
import { createMemoryManager, createShortTermMemory } from "@atlas-ai/memory";

import { tryHandleKnowledgeCommand } from "./knowledge-command.js";
import type { CliRuntime } from "./run.js";

function stubRuntime(): CliRuntime {
  const database = openAtlasDatabase({ path: ":memory:" });
  const knowledgeGraph = createKnowledgeGraph(createSqliteGraphStore(database));
  const memoryManager = createMemoryManager();
  const shortTerm = createShortTermMemory({
    maxEntries: 10,
    ttlMs: 0,
    memoryManager,
  });
  const contextManager = new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    providers: [
      createKnowledgeProvider(
        knowledgeGraph.createRetriever({
          limit: 8,
          minScore: 0.1,
          maxDepth: 2,
        }),
      ),
    ],
  });

  return {
    handler: {
      handle: () => {
        throw new Error("unused");
      },
    } as unknown as CliRuntime["handler"],
    eventBus: {
      subscribe: () => () => undefined,
    } as unknown as CliRuntime["eventBus"],
    contextManager,
    logger: { info: () => undefined } as unknown as CliRuntime["logger"],
    config: {
      memory: {
        shortTerm: { maxEntries: 10, ttlMs: 0 },
        classification: {
          minImportanceToStore: 0.45,
          minConfidenceToStore: 0.35,
          temporaryTtlMs: 86_400_000,
        },
        retrieval: {
          limit: 5,
          minScore: 0.15,
          recencyHalfLifeMs: 2_592_000_000,
        },
        consolidation: {
          mergeMinScore: 0.72,
          conflictMinScore: 0.55,
          candidateLimit: 10,
          consolidateOnStore: true,
        },
      },
      knowledge: {
        extraction: {
          enabled: true,
          minConfidence: 0.55,
          extractOnRequest: true,
        },
        relationships: {
          autoLinkOnExtract: true,
          reinforceOnLink: true,
          reinforceStep: 0.05,
        },
        retrieval: {
          limit: 8,
          minScore: 0.2,
          maxDepth: 2,
          recencyHalfLifeMs: 2_592_000_000,
        },
      },
      profile: {
        learning: {
          enabled: true,
          learnOnRequest: false,
          minConfidence: 0.55,
        },
      },
      workspace: {
        autoDetect: false,
        rememberOnDetect: false,
      },
    } as unknown as CliRuntime["config"],
    database,
    memoryManager,
    knowledgeGraph,
  };
}

describe("knowledge CLI + context wiring", () => {
  it("adds entities/relationships and traverses via CLI", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleKnowledgeCommand(
          runtime,
          "knowledge entity add --type project --name Atlas",
        ),
      ).toBe(true);
      expect(process.exitCode === 0 || process.exitCode === undefined).toBe(
        true,
      );

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          "knowledge entity add --type technology --name TypeScript",
        ),
      ).toBe(true);

      const entities = runtime.knowledgeGraph!.listEntities();
      const project = entities.find((e) => e.name === "Atlas");
      const tech = entities.find((e) => e.name === "TypeScript");
      expect(project).toBeTruthy();
      expect(tech).toBeTruthy();

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge rel add --from ${project!.id} --to ${tech!.id} --type uses`,
        ),
      ).toBe(true);

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge neighbors ${project!.id} --direction out`,
        ),
      ).toBe(true);

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge traverse ${project!.id} --depth 1`,
        ),
      ).toBe(true);

      const snap = runtime.knowledgeGraph!.exportSnapshot({
        startId: project!.id,
        maxDepth: 1,
      });
      expect(snap.nodes.length).toBeGreaterThanOrEqual(2);
      expect(snap.edges.length).toBeGreaterThanOrEqual(1);
    } finally {
      runtime.database?.close();
    }
  });

  it("extracts and stores entities via CLI", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleKnowledgeCommand(
          runtime,
          'knowledge extract --store "I talked to Alice about project Atlas using TypeScript"',
        ),
      ).toBe(true);
      expect(process.exitCode === 0 || process.exitCode === undefined).toBe(
        true,
      );
      const people = runtime.knowledgeGraph!.listEntities({ type: "person" });
      const projects = runtime.knowledgeGraph!.listEntities({
        type: "project",
      });
      expect(people.some((p) => p.name === "Alice")).toBe(true);
      expect(projects.some((p) => /Atlas/i.test(p.name))).toBe(true);
      expect(
        people[0]?.properties.source === "extraction" ||
          projects[0]?.properties.source === "extraction",
      ).toBe(true);
      // Co-mention should link project → technology
      const rels = runtime.knowledgeGraph!.listRelationships({ type: "uses" });
      expect(rels.length).toBeGreaterThanOrEqual(1);
    } finally {
      runtime.database?.close();
    }
  });

  it("links and updates relationships via CLI", () => {
    const runtime = stubRuntime();
    try {
      tryHandleKnowledgeCommand(
        runtime,
        "knowledge entity add --type project --name Atlas",
      );
      tryHandleKnowledgeCommand(
        runtime,
        "knowledge entity add --type technology --name React",
      );
      const project = runtime.knowledgeGraph!.listEntities({
        type: "project",
      })[0]!;
      const tech = runtime.knowledgeGraph!.listEntities({
        type: "technology",
      })[0]!;

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge link --from ${project.id} --to ${tech.id} --type uses`,
        ),
      ).toBe(true);
      const rel = runtime.knowledgeGraph!.listRelationships({
        fromEntityId: project.id,
        type: "uses",
      })[0]!;
      expect(rel).toBeTruthy();

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge rel update ${rel.id} --weight 0.9`,
        ),
      ).toBe(true);
      expect(runtime.knowledgeGraph!.getRelationship(rel.id)?.weight).toBe(0.9);

      expect(
        tryHandleKnowledgeCommand(
          runtime,
          `knowledge traverse ${project.id} --depth 1 --direction out --types uses`,
        ),
      ).toBe(true);

      expect(
        tryHandleKnowledgeCommand(runtime, 'knowledge retrieve "Atlas React"'),
      ).toBe(true);
    } finally {
      runtime.database?.close();
    }
  });

  it("loads knowledge snippets into context when text matches entities", () => {
    const runtime = stubRuntime();
    try {
      runtime.knowledgeGraph!.upsertEntity({
        type: "project",
        name: "Atlas",
      });
      const tech = runtime.knowledgeGraph!.upsertEntity({
        type: "technology",
        name: "React",
      });
      const project = runtime.knowledgeGraph!.listEntities({
        name: "Atlas",
      })[0]!;
      runtime.knowledgeGraph!.upsertRelationship({
        fromEntityId: project.id,
        toEntityId: tech.id,
        type: "uses",
      });

      const request = normalizeRequest({
        source: "cli",
        rawInput: "What is the Atlas stack?",
        sessionId: "kg-test",
      });
      const intent = detectIntent(request);
      const ctx = loadContext(request, intent, {
        manager: runtime.contextManager,
      });
      expect(ctx.knowledge.some((k) => k.label === "Atlas")).toBe(true);
      expect(ctx.knowledge.some((k) => k.label === "React")).toBe(true);
    } finally {
      runtime.database?.close();
    }
  });
});
