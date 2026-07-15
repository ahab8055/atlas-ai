import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildLlamaServerArgs,
  DEFAULT_CPU_HARDWARE,
  LlamaCppProvider,
  resolveGgufPath,
  resolveGpuLayers,
  validateGgufFile,
} from "./index.js";

describe("GGUF validation", () => {
  it("accepts files with GGUF magic and rejects others", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-gguf-"));
    const good = path.join(dir, "toy.gguf");
    const bad = path.join(dir, "toy.bin");
    writeFileSync(good, Buffer.from("GGUF\0\0\0\0more-bytes"));
    writeFileSync(bad, Buffer.from("NOTG"));

    expect(validateGgufFile(good).ok).toBe(true);
    expect(validateGgufFile(bad).ok).toBe(false);
    expect(resolveGgufPath("toy", dir)).toBe(good);
  });
});

describe("hardware profile", () => {
  it("forces gpuLayers=0 in CPU mode and builds -ngl 0 server args", () => {
    expect(resolveGpuLayers({ ...DEFAULT_CPU_HARDWARE, gpuLayers: 99 })).toBe(
      0,
    );
    expect(
      resolveGpuLayers({
        acceleration: "gpu",
        gpuLayers: 32,
        contextSize: 4096,
      }),
    ).toBe(32);

    const args = buildLlamaServerArgs({
      binary: "llama-server",
      modelPath: "/models/a.gguf",
      host: "127.0.0.1",
      port: 8080,
      hardware: DEFAULT_CPU_HARDWARE,
    });
    expect(args).toEqual(
      expect.arrayContaining(["-m", "/models/a.gguf", "-ngl", "0"]),
    );
  });
});

describe("LlamaCppProvider load + generate", () => {
  it("loads a local GGUF when server is healthy and generates with inference params", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-gguf-"));
    const modelPath = path.join(dir, "tiny.gguf");
    writeFileSync(modelPath, Buffer.from("GGUF\0\0\0\0weights"));

    let lastBody: Record<string, unknown> | undefined;
    const provider = new LlamaCppProvider({
      baseUrl: "http://127.0.0.1:8080",
      modelsDir: dir,
      manageServer: false,
      inference: { temperature: 0.2, maxTokens: 64, topK: 20 },
      hardware: { acceleration: "cpu", gpuLayers: 0 },
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return new Response("ok", { status: 200 });
        }
        if (url.endsWith("/v1/chat/completions")) {
          lastBody = JSON.parse(String(init?.body ?? "{}")) as Record<
            string,
            unknown
          >;
          return Response.json({
            choices: [
              {
                message: { content: "Hello from GGUF" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
          });
        }
        return new Response("no", { status: 404 });
      },
    });

    const loaded = await provider.load("tiny");
    expect(loaded.status).toBe("loaded");
    expect(loaded.format).toBe("gguf");
    expect(loaded.path).toBe(modelPath);

    const result = await provider.generate({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("Hello from GGUF");
    expect(result.provider).toBe("llamacpp");
    expect(lastBody?.temperature).toBe(0.2);
    expect(lastBody?.max_tokens).toBe(64);
    expect(lastBody?.top_k).toBe(20);
    expect(lastBody?.repeat_penalty).toBe(1.1);
  });

  it("rejects invalid GGUF files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-gguf-"));
    writeFileSync(path.join(dir, "bad.gguf"), Buffer.from("XXXX"));

    const provider = new LlamaCppProvider({
      modelsDir: dir,
      fetch: async () => new Response("ok", { status: 200 }),
    });

    await expect(provider.load("bad")).rejects.toThrow(/GGUF|Unsupported/i);
  });
});
