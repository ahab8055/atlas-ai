import { describe, expect, it } from "vitest";

import { tryHandleAiCommand } from "./ai-command.js";

describe("ai CLI command", () => {
  it("prints help for bare ai", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai");
      expect(handled).toBe(true);
      expect(writes.join("")).toContain("atlas ai status");
      expect(writes.join("")).toContain("atlas ai ask");
      expect(writes.join("")).toContain("atlas ai load");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("reports mock provider health for ai status", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    const prevProvider = process.env.ATLAS_AI_PROVIDER;
    process.env.ATLAS_AI_PROVIDER = "mock";

    try {
      const handled = await tryHandleAiCommand("ai status");
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/AI provider:\s*mock/);
      expect(text).toMatch(/Healthy:\s*yes/);
      expect(text).toMatch(/Acceleration:\s*cpu/);
      expect(text).toContain("Available providers:");
    } finally {
      process.stdout.write = originalWrite;
      if (prevProvider === undefined) {
        delete process.env.ATLAS_AI_PROVIDER;
      } else {
        process.env.ATLAS_AI_PROVIDER = prevProvider;
      }
    }
  });

  it("ask uses the mock provider for generate", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    const prevProvider = process.env.ATLAS_AI_PROVIDER;
    process.env.ATLAS_AI_PROVIDER = "mock";

    try {
      const handled = await tryHandleAiCommand('ai ask "hello local"');
      expect(handled).toBe(true);
      expect(writes.join("")).toContain("hello local");
    } finally {
      process.stdout.write = originalWrite;
      if (prevProvider === undefined) {
        delete process.env.ATLAS_AI_PROVIDER;
      } else {
        process.env.ATLAS_AI_PROVIDER = prevProvider;
      }
    }
  });

  it("ignores unrelated commands", async () => {
    expect(await tryHandleAiCommand("status")).toBe(false);
    expect(await tryHandleAiCommand("history")).toBe(false);
  });
});
