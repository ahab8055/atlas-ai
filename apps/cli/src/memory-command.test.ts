import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";
import {
  createLongTermMemory,
  createPersistentMemoryManager,
  createShortTermMemory,
} from "@atlas-ai/memory";
import {
  ContextManager,
  createMemoryProvider,
  detectIntent,
  loadContext,
  normalizeRequest,
} from "@atlas-ai/core";

import { tryHandleMemoryCommand } from "./memory-command.js";
import type { CliRuntime } from "./run.js";

function stubRuntime(): CliRuntime {
  const database = openAtlasDatabase({ path: ":memory:" });
  const memoryManager = createPersistentMemoryManager(database.memories);
  const longTermMemory = createLongTermMemory(database.memories);
  const shortTerm = createShortTermMemory({
    maxEntries: 10,
    ttlMs: 0,
    memoryManager,
  });
  const contextManager = new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    providers: [createMemoryProvider(longTermMemory.createRetriever())],
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
          extractOnRequest: false,
        },
        relationships: {
          autoLinkOnExtract: false,
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
          minOccurrences: 2,
          requireApproval: true,
          autoApply: false,
        },
      },
      workspace: {
        autoDetect: false,
        rememberOnDetect: false,
      },
    } as unknown as CliRuntime["config"],
    database,
    memoryManager,
    longTermMemory,
  };
}

describe("memory CLI + context wiring", () => {
  it("adds and searches memories via CLI handler", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleMemoryCommand(
          runtime,
          'memory add --type semantic "Prefers TypeScript"',
        ),
      ).toBe(true);
      expect(process.exitCode === 0 || process.exitCode === undefined).toBe(
        true,
      );

      const listed = runtime.longTermMemory!.list({ type: "semantic" });
      expect(listed.some((m) => m.content.includes("TypeScript"))).toBe(true);

      expect(
        tryHandleMemoryCommand(runtime, 'memory search "TypeScript"'),
      ).toBe(true);
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });

  it("injects relevant memories into LoadedContext", () => {
    const runtime = stubRuntime();
    try {
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.9,
      });

      const request = normalizeRequest({
        source: "cli",
        rawInput: "change theme to dark mode",
        sessionId: "mem-ctx",
      });
      const intent = detectIntent(request);
      const context = loadContext(request, intent, {
        manager: runtime.contextManager,
      });

      expect(context.memories.length).toBeGreaterThan(0);
      expect(context.memories[0]?.content).toContain("dark mode");
      expect(context.sources).toContain("memory");
    } finally {
      runtime.database?.close();
    }
  });

  it("classifies without requiring database writes", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleMemoryCommand(
          runtime,
          'memory classify "I like dark mode interfaces."',
        ),
      ).toBe(true);
      expect(process.exitCode === 0 || process.exitCode === undefined).toBe(
        true,
      );
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });

  it("add --classify stores preferences and skips coffee chatter", () => {
    const runtime = stubRuntime();
    try {
      expect(
        tryHandleMemoryCommand(
          runtime,
          'memory add --classify "I like dark mode interfaces."',
        ),
      ).toBe(true);
      expect(
        tryHandleMemoryCommand(
          runtime,
          'memory add --classify "This coffee tastes good."',
        ),
      ).toBe(true);

      const listed = runtime.longTermMemory!.list();
      expect(listed.some((m) => m.content.includes("dark mode"))).toBe(true);
      expect(listed.some((m) => m.content.includes("coffee"))).toBe(false);
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });

  it("purge-expired removes memories past expiresAt", () => {
    const runtime = stubRuntime();
    try {
      const past = new Date(Date.now() - 60_000).toISOString();
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "temporary note",
        metadata: { expiresAt: past },
      });
      expect(tryHandleMemoryCommand(runtime, "memory purge-expired")).toBe(
        true,
      );
      expect(runtime.longTermMemory!.list()).toHaveLength(0);
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });

  it("retrieves ranked memories via CLI", () => {
    const runtime = stubRuntime();
    try {
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.9,
        confidence: 0.9,
      });
      expect(
        tryHandleMemoryCommand(
          runtime,
          'memory retrieve "change theme to dark"',
        ),
      ).toBe(true);
      expect(process.exitCode === 0 || process.exitCode === undefined).toBe(
        true,
      );
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });

  it("consolidates duplicates and lists conflicts via CLI", () => {
    const runtime = stubRuntime();
    try {
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.9,
      });
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.8,
      });
      expect(
        tryHandleMemoryCommand(runtime, "memory consolidate --type semantic"),
      ).toBe(true);
      expect(runtime.longTermMemory!.list().length).toBe(1);

      runtime.longTermMemory!.store({
        type: "semantic",
        content: "User prefers dark mode",
        importance: 0.9,
      });
      runtime.longTermMemory!.store({
        type: "semantic",
        content: "User prefers light mode",
        importance: 0.9,
      });
      expect(tryHandleMemoryCommand(runtime, "memory consolidate")).toBe(true);
      expect(tryHandleMemoryCommand(runtime, "memory conflicts")).toBe(true);
    } finally {
      runtime.database?.close();
      process.exitCode = undefined;
    }
  });
});
