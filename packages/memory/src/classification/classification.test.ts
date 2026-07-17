import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import {
  classifyMemory,
  createLongTermMemory,
  purgeExpiredMemories,
  resolveAction,
  shouldPersist,
} from "../index.js";

describe("classifyMemory", () => {
  it("stores preference as semantic (Architecture dark-mode example)", () => {
    const result = classifyMemory({
      text: "I like dark mode interfaces.",
    });
    expect(result.action).toBe("store_long_term");
    expect(result.suggestedType).toBe("semantic");
    expect(result.durability).toBe("permanent");
    expect(result.importance).toBeGreaterThanOrEqual(0.45);
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
  });

  it("discards ephemeral chatter (Architecture coffee example)", () => {
    const result = classifyMemory({
      text: "This coffee tastes good.",
    });
    expect(result.action).toBe("discard");
    expect(result.suggestedType).toBe("none");
    expect(result.importance).toBeLessThan(0.45);
  });

  it("boosts explicit remember requests to high confidence permanent", () => {
    const result = classifyMemory({
      text: "Remember my API key lives in .env",
    });
    expect(result.action).toBe("store_long_term");
    expect(result.durability).toBe("permanent");
    expect(result.importance).toBeGreaterThanOrEqual(0.9);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.suggestedType).toBe("semantic");
  });

  it("classifies episodic past incidents", () => {
    const result = classifyMemory({
      text: "Yesterday we fixed the auth incident in staging",
    });
    expect(result.action).toBe("store_long_term");
    expect(result.suggestedType).toBe("episodic");
  });

  it("classifies procedural workflows", () => {
    const result = classifyMemory({
      text: "My usual workflow every morning is to open the project dashboard",
    });
    expect(result.action).toBe("store_long_term");
    expect(result.suggestedType).toBe("procedural");
  });

  it("discards empty text", () => {
    const result = classifyMemory({ text: "   " });
    expect(result.action).toBe("discard");
    expect(result.importance).toBe(0);
  });

  it("honors explicitRemember flag", () => {
    const result = classifyMemory({
      text: "use the staging cluster",
      explicitRemember: true,
    });
    expect(result.action).toBe("store_long_term");
    expect(result.importance).toBeGreaterThanOrEqual(0.9);
  });
});

describe("policy helpers", () => {
  it("shouldPersist only for store_long_term above thresholds", () => {
    expect(
      shouldPersist({
        action: "store_long_term",
        importance: 0.8,
        confidence: 0.7,
      }),
    ).toBe(true);
    expect(
      shouldPersist({
        action: "discard",
        importance: 0.9,
        confidence: 0.9,
      }),
    ).toBe(false);
  });

  it("resolveAction discards below thresholds", () => {
    expect(
      resolveAction({
        importance: 0.2,
        confidence: 0.2,
        durability: "permanent",
        suggestedType: "semantic",
      }),
    ).toBe("discard");
  });
});

describe("evaluateAndStore + purge", () => {
  it("evaluateAndStore persists preferences and skips coffee chatter", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);

      const stored = ltm.evaluateAndStore("I like dark mode interfaces.");
      expect(stored.stored).toBe(true);
      expect(stored.record?.type).toBe("semantic");

      const skipped = ltm.evaluateAndStore("This coffee tastes good.");
      expect(skipped.stored).toBe(false);
      expect(skipped.classification.action).toBe("discard");

      expect(ltm.list().length).toBe(1);
    } finally {
      db.close();
    }
  });

  it("purgeExpiredMemories deletes rows past metadata.expiresAt", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();

      ltm.store({
        type: "semantic",
        content: "expired fact",
        metadata: { expiresAt: past },
      });
      ltm.store({
        type: "semantic",
        content: "fresh fact",
        metadata: { expiresAt: future },
      });

      const result = purgeExpiredMemories(db.memories);
      expect(result.deleted).toBe(1);
      expect(ltm.list().map((m) => m.content)).toEqual(["fresh fact"]);
    } finally {
      db.close();
    }
  });
});
