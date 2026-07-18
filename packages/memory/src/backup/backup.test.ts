import { describe, expect, it } from "vitest";

import {
  buildSnapshot,
  computeChecksum,
  decryptBackup,
  encryptBackup,
  validateSnapshot,
} from "./index.js";
import type { MemoryRecord } from "../types.js";

function sampleRecords(): MemoryRecord[] {
  return [
    {
      id: "m1",
      type: "semantic",
      scope: "long_term",
      content: "Prefers TypeScript",
      importance: 0.9,
      sensitivity: "normal",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m2",
      type: "semantic",
      scope: "long_term",
      content: "private medical note",
      sensitivity: "sensitive",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];
}

describe("memory backup snapshot", () => {
  it("builds a valid snapshot with matching checksum", () => {
    const snap = buildSnapshot(sampleRecords());
    expect(snap.format).toBe("atlas.memory.backup");
    expect(snap.version).toBe(1);
    expect(snap.count).toBe(2);
    expect(snap.checksum).toBe(computeChecksum(snap.memories));
    const validated = validateSnapshot(snap);
    expect(validated.ok).toBe(true);
    expect(validated.snapshot?.memories).toHaveLength(2);
  });

  it("rejects tampered checksum", () => {
    const snap = buildSnapshot(sampleRecords());
    snap.memories[0]!.content = "tampered";
    const validated = validateSnapshot(snap);
    expect(validated.ok).toBe(false);
    expect(validated.errors.some((e) => e.includes("Checksum"))).toBe(true);
  });

  it("encrypts and decrypts with passphrase", () => {
    const snap = buildSnapshot(sampleRecords());
    const envelope = encryptBackup(snap, "test-passphrase-123");
    expect(envelope.format).toBe("atlas.memory.backup.encrypted");
    expect(envelope.ciphertext).not.toContain("TypeScript");
    const restored = decryptBackup(envelope, "test-passphrase-123");
    expect(restored.memories[0]?.content).toBe("Prefers TypeScript");
    expect(restored.checksum).toBe(snap.checksum);
  });

  it("fails decrypt with wrong passphrase", () => {
    const snap = buildSnapshot(sampleRecords());
    const envelope = encryptBackup(snap, "correct-secret");
    expect(() => decryptBackup(envelope, "wrong-secret")).toThrow();
  });
});
