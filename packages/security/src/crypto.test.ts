import { describe, expect, it } from "vitest";

import {
  decryptAesGcm,
  encryptAesGcm,
  generateAesGcmKey,
  keyFromBase64,
  keyToBase64,
} from "./crypto.js";

describe("encryptAesGcm / decryptAesGcm", () => {
  it("round-trips plaintext", () => {
    const key = generateAesGcmKey();
    const payload = encryptAesGcm("secret memory note", key);
    expect(payload.version).toBe(1);
    expect(payload.ciphertext).not.toContain("secret");
    expect(decryptAesGcm(payload, key)).toBe("secret memory note");
  });

  it("fails with wrong key", () => {
    const key = generateAesGcmKey();
    const other = generateAesGcmKey();
    const payload = encryptAesGcm("hello", key);
    expect(() => decryptAesGcm(payload, other)).toThrow();
  });

  it("keyToBase64 / keyFromBase64 round-trip", () => {
    const key = generateAesGcmKey();
    const restored = keyFromBase64(keyToBase64(key));
    expect(restored).toEqual(key);
  });

  it("rejects invalid key length", () => {
    expect(() => encryptAesGcm("x", new Uint8Array(16))).toThrow(/32 bytes/);
  });
});
