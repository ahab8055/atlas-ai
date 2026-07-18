import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";
import { generateAesGcmKey, PermissionManager } from "@atlas-ai/security";

import { createLongTermMemory } from "../long-term/index.js";
import { createStaticDekProvider, MemoryAccessLog } from "../security/index.js";
import { encryptBackup, validateSnapshot } from "./index.js";

describe("LongTermMemory backup", () => {
  it("round-trips export and import including sensitive rows", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const key = generateAesGcmKey();
      const perms = new PermissionManager({
        grantedCapabilities: ["memory.read", "memory.write", "memory.delete"],
      });
      const ltm = createLongTermMemory(db.memories, {
        permissions: perms,
        dek: createStaticDekProvider(key),
        accessLog: new MemoryAccessLog(),
      });
      ltm.store({
        type: "semantic",
        content: "Prefers TypeScript",
        importance: 0.9,
      });
      ltm.store({
        type: "semantic",
        content: "private medical note",
        sensitivity: "sensitive",
      });

      const snap = ltm.exportBackup();
      expect(snap.count).toBe(2);
      expect(validateSnapshot(snap).ok).toBe(true);

      const db2 = openAtlasDatabase({ path: ":memory:", skipSeed: true });
      try {
        const ltm2 = createLongTermMemory(db2.memories, {
          permissions: perms,
          dek: createStaticDekProvider(generateAesGcmKey()),
        });
        const result = ltm2.importBackup(snap);
        expect(result.imported).toBe(2);
        expect(result.errors).toEqual([]);
        const listed = ltm2.list({ limit: 10 });
        expect(listed.some((m) => m.content.includes("TypeScript"))).toBe(true);
        expect(listed.some((m) => m.content.includes("private medical"))).toBe(
          true,
        );
        const sensitive = listed.find((m) =>
          m.content.includes("private medical"),
        );
        expect(sensitive?.encrypted).toBe(true);
        const raw = db2.memories.get(sensitive!.id)!;
        expect(raw.content).not.toContain("private medical");
      } finally {
        db2.close();
      }
    } finally {
      db.close();
    }
  });

  it("refuses import when checksum is tampered", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(generateAesGcmKey()),
      });
      ltm.store({ type: "semantic", content: "hello" });
      const snap = ltm.exportBackup();
      snap.memories[0]!.content = "evil";
      const result = ltm.importBackup(snap);
      expect(result.imported).toBe(0);
      expect(result.errors.some((e) => e.includes("Checksum"))).toBe(true);
    } finally {
      db.close();
    }
  });

  it("merge preserves unrelated memories; replace clears first", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const perms = new PermissionManager({
        grantedCapabilities: ["memory.read", "memory.write", "memory.delete"],
      });
      const ltm = createLongTermMemory(db.memories, {
        permissions: perms,
        dek: createStaticDekProvider(generateAesGcmKey()),
      });
      const keep = ltm.store({
        type: "semantic",
        content: "keep me",
      });
      const snap = buildOnlyOne();
      const merged = ltm.importBackup(snap, { mode: "merge" });
      expect(merged.imported).toBe(1);
      expect(ltm.list().some((m) => m.id === keep.id)).toBe(true);
      expect(ltm.list().some((m) => m.content === "from backup")).toBe(true);

      const replaced = ltm.importBackup(snap, { mode: "replace" });
      expect(replaced.imported).toBe(1);
      expect(ltm.list()).toHaveLength(1);
      expect(ltm.list()[0]?.content).toBe("from backup");
    } finally {
      db.close();
    }

    function buildOnlyOne() {
      const other = openAtlasDatabase({ path: ":memory:", skipSeed: true });
      try {
        const tmp = createLongTermMemory(other.memories, {
          dek: createStaticDekProvider(generateAesGcmKey()),
        });
        tmp.store({
          id: "backup-only",
          type: "semantic",
          content: "from backup",
        });
        return tmp.exportBackup();
      } finally {
        other.close();
      }
    }
  });

  it("denies export without memory.read", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories, {
        permissions: new PermissionManager(),
      });
      expect(() => ltm.exportBackup()).toThrow(/Permission denied|memory.read/);
    } finally {
      db.close();
    }
  });

  it("encrypted envelope round-trips via encryptBackup", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(generateAesGcmKey()),
      });
      ltm.store({ type: "semantic", content: "device migration preference" });
      const snap = ltm.exportBackup();
      const envelope = encryptBackup(snap, "device-migrate-pass");
      expect(JSON.stringify(envelope)).not.toContain("device migration");
    } finally {
      db.close();
    }
  });
});
