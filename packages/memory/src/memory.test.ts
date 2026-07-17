import { describe, expect, it } from "vitest";

import { MemoryError } from "./errors.js";
import { createMemoryManager, toMemorySnippets } from "./manager.js";
import type { MemoryProvider } from "./provider.js";
import {
  InMemoryEpisodicMemoryProvider,
  InMemorySemanticMemoryProvider,
} from "./providers/in-memory.js";
import { MemoryProviderRegistry } from "./registry.js";
import { registerBuiltinMemoryProviders } from "./providers/register.js";
import type {
  ClearMemoryOptions,
  CreateMemoryInput,
  MemoryQuery,
  MemoryRecord,
  UpdateMemoryInput,
} from "./types.js";
import { scopeForType } from "./types.js";

describe("scopeForType", () => {
  it("maps working to short_term and others to long_term", () => {
    expect(scopeForType("working")).toBe("short_term");
    expect(scopeForType("episodic")).toBe("long_term");
    expect(scopeForType("semantic")).toBe("long_term");
    expect(scopeForType("procedural")).toBe("long_term");
  });
});

describe("MemoryProviderRegistry", () => {
  it("registers and requires providers", () => {
    const registry = new MemoryProviderRegistry();
    registry.register(new InMemoryEpisodicMemoryProvider());
    expect(registry.types()).toEqual(["episodic"]);
    expect(registry.require("episodic").type).toBe("episodic");
  });

  it("throws when registering a duplicate without replace", () => {
    const registry = new MemoryProviderRegistry();
    registry.register(new InMemoryEpisodicMemoryProvider());
    expect(() =>
      registry.register(new InMemoryEpisodicMemoryProvider()),
    ).toThrow(MemoryError);
  });

  it("throws for unknown type", () => {
    const registry = new MemoryProviderRegistry();
    expect(() => registry.require("semantic")).toThrow(MemoryError);
  });

  it("replaces when replace is true", () => {
    const registry = new MemoryProviderRegistry();
    registry.register(new InMemoryEpisodicMemoryProvider());
    const replacement = new InMemoryEpisodicMemoryProvider();
    registry.register(replacement, { replace: true });
    expect(registry.require("episodic")).toBe(replacement);
  });
});

describe("memory type isolation", () => {
  it("keeps episodic records out of semantic queries", async () => {
    const manager = createMemoryManager();
    await manager.store({
      type: "episodic",
      content: "Fixed payment webhook in June",
    });
    await manager.store({
      type: "semantic",
      content: "Prefers TypeScript",
    });

    const semantic = await manager.query({ type: "semantic" });
    expect(semantic).toHaveLength(1);
    expect(semantic[0]?.content).toContain("TypeScript");

    const episodic = await manager.query({ type: "episodic" });
    expect(episodic).toHaveLength(1);
    expect(episodic[0]?.content).toContain("webhook");
  });

  it("uses separate provider stores for builtins", async () => {
    const episodic = new InMemoryEpisodicMemoryProvider();
    const semantic = new InMemorySemanticMemoryProvider();
    await episodic.store({
      type: "episodic",
      content: "only episodic",
    });
    const fromSemantic = await semantic.query({ text: "episodic" });
    expect(fromSemantic).toEqual([]);
  });
});

describe("working memory sessions", () => {
  it("clears only the requested session", async () => {
    const manager = createMemoryManager();
    await manager.store({
      type: "working",
      content: "session-a task",
      sessionId: "a",
    });
    await manager.store({
      type: "working",
      content: "session-b task",
      sessionId: "b",
    });

    const removed = await manager.clear("working", { sessionId: "a" });
    expect(removed).toBe(1);

    const remaining = await manager.query({ type: "working" });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.sessionId).toBe("b");
  });
});

describe("MemoryManager", () => {
  it("supports CRUD and cross-type query", async () => {
    const manager = createMemoryManager();
    const created = await manager.store({
      type: "semantic",
      content: "Preferred editor is Cursor",
      importance: 0.9,
      confidence: 0.95,
      tags: ["preference"],
    });
    expect(created.scope).toBe("long_term");
    expect(created.type).toBe("semantic");

    const fetched = await manager.get(created.id);
    expect(fetched?.content).toContain("Cursor");

    const updated = await manager.update(created.id, {
      content: "Preferred editor is Cursor IDE",
    });
    expect(updated.content).toContain("IDE");

    await manager.store({
      type: "procedural",
      content: "Morning: open Slack then calendar",
    });

    const hits = await manager.query({ text: "editor", limit: 5 });
    expect(hits.some((h) => h.id === created.id)).toBe(true);

    const snippets = toMemorySnippets(hits, "editor");
    expect(snippets[0]?.kind).toBeDefined();
    expect(snippets.some((s) => s.id === created.id)).toBe(true);

    expect(await manager.delete(created.id)).toBe(true);
    expect(await manager.get(created.id)).toBeUndefined();
  });

  it("filters by long_term scope", async () => {
    const manager = createMemoryManager();
    await manager.store({ type: "working", content: "temp", sessionId: "s1" });
    await manager.store({ type: "semantic", content: "durable fact" });

    const longTerm = await manager.query({ scope: "long_term" });
    expect(longTerm.every((r) => r.scope === "long_term")).toBe(true);
    expect(longTerm.some((r) => r.content.includes("durable"))).toBe(true);
  });
});

describe("custom MemoryProvider plug-in", () => {
  it("uses a custom provider without changing MemoryManager", async () => {
    class FixedSemanticProvider implements MemoryProvider {
      readonly type = "semantic" as const;
      private record: MemoryRecord | undefined;

      async store(input: CreateMemoryInput): Promise<MemoryRecord> {
        const now = new Date().toISOString();
        this.record = {
          id: input.id ?? "fixed-1",
          type: "semantic",
          scope: "long_term",
          content: `custom:${input.content}`,
          createdAt: now,
          updatedAt: now,
        };
        return { ...this.record };
      }

      async get(id: string): Promise<MemoryRecord | undefined> {
        return this.record?.id === id ? { ...this.record } : undefined;
      }

      async update(
        id: string,
        _patch: UpdateMemoryInput,
      ): Promise<MemoryRecord> {
        if (!this.record || this.record.id !== id) {
          throw MemoryError.notFound(id);
        }
        return { ...this.record };
      }

      async delete(id: string): Promise<boolean> {
        if (this.record?.id === id) {
          this.record = undefined;
          return true;
        }
        return false;
      }

      async query(_query: MemoryQuery): Promise<MemoryRecord[]> {
        return this.record ? [{ ...this.record }] : [];
      }

      async clear(_options?: ClearMemoryOptions): Promise<number> {
        const n = this.record ? 1 : 0;
        this.record = undefined;
        return n;
      }
    }

    const registry = new MemoryProviderRegistry();
    registerBuiltinMemoryProviders(registry);
    registry.register(new FixedSemanticProvider(), { replace: true });

    const manager = createMemoryManager({ registry, skipBuiltins: true });
    const stored = await manager.store({
      type: "semantic",
      content: "hello",
    });
    expect(stored.content).toBe("custom:hello");
    expect(stored.id).toBe("fixed-1");
  });
});
