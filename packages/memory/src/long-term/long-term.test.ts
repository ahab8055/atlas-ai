import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import { MemoryError } from "../errors.js";
import {
  createLongTermMemory,
  createPersistentMemoryManager,
} from "../index.js";

describe("LongTermMemory", () => {
  it("stores, searches by relevance, updates, and deletes", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const ltm = createLongTermMemory(atlas.memories);

    ltm.store({
      type: "semantic",
      content: "Preferred editor is Cursor",
      importance: 0.9,
    });
    ltm.store({
      type: "episodic",
      content: "Fixed payment webhook last June",
      importance: 0.4,
    });
    ltm.store({
      type: "procedural",
      content: "Morning workflow opens Slack then calendar",
      importance: 0.6,
    });

    const hits = ltm.search("editor Cursor", { limit: 3 });
    expect(hits[0]?.content).toContain("Cursor");
    expect(hits[0]?.type).toBe("semantic");

    const updated = ltm.update(hits[0]!.id, {
      content: "Preferred editor is Cursor IDE",
    });
    expect(updated.content).toContain("IDE");
    expect(ltm.delete(updated.id)).toBe(true);
    expect(ltm.get(updated.id)).toBeUndefined();

    atlas.close();
  });

  it("rejects working type", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const ltm = createLongTermMemory(atlas.memories);
    expect(() => ltm.store({ type: "working", content: "temp" })).toThrow(
      MemoryError,
    );
    atlas.close();
  });

  it("isolates sqlite providers by type via MemoryManager", async () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const manager = createPersistentMemoryManager(atlas.memories);

    await manager.store({
      type: "episodic",
      content: "only episodic",
    });
    const semantic = await manager.query({ type: "semantic" });
    expect(semantic).toEqual([]);
    const episodic = await manager.query({ type: "episodic" });
    expect(episodic).toHaveLength(1);

    atlas.close();
  });

  it("createRetriever returns snippets for context", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const ltm = createLongTermMemory(atlas.memories);
    ltm.store({
      type: "semantic",
      content: "User prefers dark mode",
      importance: 0.95,
    });
    const retrieve = ltm.createRetriever({ limit: 3 });
    const snippets = retrieve({
      sessionId: "s1",
      text: "dark mode settings",
      intentName: "chat",
    });
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0]?.content).toContain("dark mode");
    expect(snippets[0]?.kind).toBe("semantic");
    atlas.close();
  });
});
