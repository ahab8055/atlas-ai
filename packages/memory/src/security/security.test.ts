import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";
import { generateAesGcmKey, PermissionManager } from "@atlas-ai/security";

import { createLongTermMemory } from "../long-term/index.js";
import { createStaticDekProvider, MemoryAccessLog } from "./index.js";

describe("Memory security", () => {
  it("encrypts sensitive content at rest and decrypts on read", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const key = generateAesGcmKey();
      const accessLog = new MemoryAccessLog();
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(key),
        accessLog,
      });
      const stored = ltm.store({
        type: "semantic",
        content: "private medical note",
        sensitivity: "sensitive",
        importance: 0.9,
      });
      expect(stored.content).toBe("private medical note");
      expect(stored.encrypted).toBe(true);

      const raw = db.memories.get(stored.id)!;
      expect(raw.encrypted).toBe(true);
      expect(raw.content).not.toBe("private medical note");
      expect(raw.contentNonce).toBeTruthy();

      expect(ltm.get(stored.id)?.content).toBe("private medical note");
      expect(accessLog.list().some((e) => e.action === "create")).toBe(true);
      expect(accessLog.list().some((e) => e.action === "read")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("denies access without permission grant", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const perms = new PermissionManager();
      const ltm = createLongTermMemory(db.memories, { permissions: perms });
      expect(() => ltm.store({ type: "semantic", content: "hello" })).toThrow(
        /Permission denied|Confirm system action|memory.write/,
      );
    } finally {
      db.close();
    }
  });

  it("allows operations when capabilities are granted", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const perms = new PermissionManager({
        grantedCapabilities: ["memory.read", "memory.write", "memory.delete"],
      });
      const key = generateAesGcmKey();
      const accessLog = new MemoryAccessLog();
      const ltm = createLongTermMemory(db.memories, {
        permissions: perms,
        dek: createStaticDekProvider(key),
        accessLog,
      });
      const row = ltm.store({
        type: "semantic",
        content: "Prefers TypeScript",
      });
      expect(ltm.get(row.id)?.content).toContain("TypeScript");
      expect(ltm.secureDelete(row.id)).toBe(true);
      expect(ltm.get(row.id)).toBeUndefined();
      expect(
        accessLog.list().some((e) => e.action === "delete" && e.secure),
      ).toBe(true);
    } finally {
      db.close();
    }
  });

  it("searches decrypted sensitive memories", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const key = generateAesGcmKey();
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(key),
      });
      ltm.store({
        type: "semantic",
        content: "UniqueSecretPhrase atlas preference",
        sensitivity: "sensitive",
        importance: 0.9,
      });
      const hits = ltm.search("UniqueSecretPhrase", {
        mode: "keyword",
        minScore: 0.05,
      });
      expect(hits[0]?.content).toContain("UniqueSecretPhrase");
    } finally {
      db.close();
    }
  });

  it("refuses secret-shaped plaintext without sensitive flag", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(generateAesGcmKey()),
      });
      expect(() =>
        ltm.store({
          type: "semantic",
          content: "api_key: sk-abcdefghijklmnopqrstuvwxyz",
        }),
      ).toThrow(/sensitivity: sensitive/);
    } finally {
      db.close();
    }
  });

  it("fails closed when storing sensitive without DEK", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories);
      expect(() =>
        ltm.store({
          type: "semantic",
          content: "private",
          sensitivity: "sensitive",
        }),
      ).toThrow(/DEK/);
    } finally {
      db.close();
    }
  });
});
