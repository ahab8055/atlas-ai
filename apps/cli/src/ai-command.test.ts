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
      expect(writes.join("")).toContain("atlas ai register");
      expect(writes.join("")).toContain("atlas ai storage");
      expect(writes.join("")).toContain("atlas ai validate");
      expect(writes.join("")).toContain("atlas ai remove");
      expect(writes.join("")).toContain("atlas ai hardware");
      expect(writes.join("")).toContain("atlas ai profiles");
      expect(writes.join("")).toContain("atlas ai recommend");
      expect(writes.join("")).toContain("atlas ai install");
      expect(writes.join("")).toContain("atlas ai check");
      expect(writes.join("")).toContain("atlas ai route");
      expect(writes.join("")).toContain("atlas ai inference");
      expect(writes.join("")).toContain("atlas ai runtime");
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

  it("register syncs into memory registry when DB disabled", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai register", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      expect(writes.join("")).toMatch(/Registered \d+ model/);
      expect(writes.join("")).toContain("memory");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("storage reports controlled models directory usage", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai storage", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toContain("Models directory:");
      expect(text).toContain("Structure ready:");
      expect(text).toContain("Total size:");
      expect(text).toContain("general");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("hardware reports CPU RAM OS and resource profile", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai hardware", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/CPU:/);
      expect(text).toMatch(/RAM:/);
      expect(text).toMatch(/Hardware profile:/);
      expect(text).toMatch(/Suggested inference:/);
      expect(text).toMatch(/Recommended models:/);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("profiles lists low balanced and performance", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai profiles", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toContain("low");
      expect(text).toContain("balanced");
      expect(text).toContain("performance");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("check reports compatibility sections", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai check mock-general", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/Compatibility:/);
      expect(text).toMatch(/RAM:/);
      expect(text).toMatch(/CPU:/);
      expect(text).toMatch(/GPU:/);
      expect(text).toMatch(/Storage:/);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("route explains task analysis and selection", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand('ai route "hello there"', {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/Routing:/);
      expect(text).toMatch(/Complexity:/);
      expect(text).toMatch(/Reasons:/);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("inference shows temperature tokens context and stream", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai inference");
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/temperature:/);
      expect(text).toMatch(/maxTokens:/);
      expect(text).toMatch(/contextLength:/);
      expect(text).toMatch(/stream:/);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("runtime shows phase and memory tracking", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const handled = await tryHandleAiCommand("ai runtime", {
        enableDatabase: false,
      });
      expect(handled).toBe(true);
      const text = writes.join("");
      expect(text).toMatch(/Runtime:/);
      expect(text).toMatch(/Memory:/);
      expect(text).toMatch(/Open sessions:/);
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("ignores unrelated commands", async () => {
    expect(await tryHandleAiCommand("status")).toBe(false);
    expect(await tryHandleAiCommand("history")).toBe(false);
  });
});
