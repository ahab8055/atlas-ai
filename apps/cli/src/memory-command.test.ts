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
});
