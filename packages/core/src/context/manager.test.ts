import { describe, expect, it } from "vitest";

import { detectIntent } from "../intent/detect.js";
import { normalizeRequest } from "../normalize.js";
import {
  ContextManager,
  createMemoryProvider,
  InMemoryConversationStore,
  loadContext,
} from "./index.js";

describe("context management", () => {
  it("collects conversation, preferences, tasks, and system state", () => {
    const manager = new ContextManager();
    manager.preferenceStore.patch({ timezone: "UTC" });
    manager.taskStore.upsert({
      id: "t1",
      description: "Wire context providers",
      status: "in_progress",
    });

    const request = normalizeRequest({
      source: "cli",
      rawInput: "status",
      sessionId: "ctx-1",
    });
    const intent = detectIntent(request);
    const context = loadContext(request, intent, { manager });

    expect(context.sources).toEqual(
      expect.arrayContaining([
        "conversation",
        "preferences",
        "active_tasks",
        "system",
        "project",
        "memory",
        "knowledge",
      ]),
    );
    expect(context.conversation.sessionId).toBe("ctx-1");
    expect(context.conversation.turns).toHaveLength(1);
    expect(context.conversation.turns[0]?.role).toBe("user");
    expect(context.preferences.preferredEditor).toBe("VS Code");
    expect(context.preferences.timezone).toBe("UTC");
    expect(context.activeTasks).toHaveLength(1);
    expect(context.systemState.runtime).toBe("atlas-core");
    expect(context.systemState.source).toBe("cli");
    expect(context.systemState.platform).toBeTruthy();
    expect(context.project?.name).toBe("Atlas AI");
    expect(context.memories).toEqual([]);
    expect(context.knowledge).toEqual([]);
    expect(context.conversationSummary).toContain("ctx-1");
    expect(context.assembledAt).toBeTruthy();
  });

  it("keeps conversation context across turns in a session", () => {
    const store = new InMemoryConversationStore();
    const manager = new ContextManager({ conversationStore: store });

    const firstReq = normalizeRequest({
      source: "cli",
      rawInput: "ping",
      sessionId: "chat-a",
    });
    const firstIntent = detectIntent(firstReq);
    const first = loadContext(firstReq, firstIntent, { manager });
    manager.recordAssistant("chat-a", "Atlas core OK", firstIntent.name);

    const secondReq = normalizeRequest({
      source: "cli",
      rawInput: "help",
      sessionId: "chat-a",
    });
    const secondIntent = detectIntent(secondReq);
    const second = loadContext(secondReq, secondIntent, { manager });

    expect(first.conversation.turns).toHaveLength(1);
    expect(second.conversation.turns.map((t) => t.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(second.conversation.turns[1]?.text).toContain("Atlas core OK");
  });

  it("supports swapping in a memory provider for future integration", () => {
    const manager = new ContextManager({
      providers: [
        createMemoryProvider(() => [
          {
            id: "m1",
            content: "User prefers dark mode",
            kind: "semantic",
            score: 0.91,
          },
        ]),
      ],
    });

    const request = normalizeRequest({
      source: "desktop",
      rawInput: "Open Terminal",
      sessionId: "mem-1",
    });
    const intent = detectIntent(request);
    const context = manager.load(request, intent);

    expect(context.memories).toHaveLength(1);
    expect(context.memories[0]?.content).toContain("dark mode");
    expect(context.sources).toContain("memory");
  });

  it("honors configurable maxTurns on conversation store", () => {
    const store = new InMemoryConversationStore({ maxTurns: 2, ttlMs: 0 });
    const manager = new ContextManager({ conversationStore: store });

    for (const text of ["one", "two", "three"]) {
      const req = normalizeRequest({
        source: "cli",
        rawInput: text,
        sessionId: "trim-1",
      });
      loadContext(req, detectIntent(req), { manager });
    }

    const turns = store.getTurns("trim-1");
    expect(turns).toHaveLength(2);
    expect(turns.map((t) => t.text)).toEqual(["two", "three"]);
  });

  it("expires conversation turns via ttlMs", () => {
    let now = Date.parse("2026-01-01T12:00:00.000Z");
    const store = new InMemoryConversationStore({
      maxTurns: 10,
      ttlMs: 60_000,
      now: () => now,
    });
    store.append("ttl-1", {
      role: "user",
      text: "stale",
      at: "2026-01-01T11:58:00.000Z",
    });
    store.append("ttl-1", {
      role: "assistant",
      text: "ok",
      at: "2026-01-01T11:59:30.000Z",
    });

    now = Date.parse("2026-01-01T12:00:00.000Z");
    const turns = store.getTurns("ttl-1");
    expect(turns).toHaveLength(1);
    expect(turns[0]?.text).toBe("ok");
  });

  it("uses shortTermOptions for default ShortTermMemory-backed store", () => {
    const manager = new ContextManager({
      shortTermOptions: { maxEntries: 2, ttlMs: 0 },
    });

    for (const text of ["a", "b", "c"]) {
      const req = normalizeRequest({
        source: "cli",
        rawInput: text,
        sessionId: "stm-1",
      });
      loadContext(req, detectIntent(req), { manager });
    }

    const turns = manager.conversationStore.getTurns("stm-1");
    expect(turns).toHaveLength(2);
    expect(turns.map((t) => t.text)).toEqual(["b", "c"]);
  });
});
