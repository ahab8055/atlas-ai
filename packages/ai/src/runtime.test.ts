import { describe, expect, it } from "vitest";

import {
  AiRuntimeError,
  createAiRuntime,
  InferenceProviderRegistry,
  LlamaCppProvider,
  MockInferenceProvider,
} from "./index.js";

describe("MockInferenceProvider", () => {
  it("loads, generates, streams, and unloads offline", async () => {
    const provider = new MockInferenceProvider();
    await expect(provider.health()).resolves.toMatchObject({
      ok: true,
      provider: "mock",
    });

    const loaded = await provider.load("mock-general");
    expect(loaded.status).toBe("loaded");

    const result = await provider.generate({
      messages: [{ role: "user", content: "hello atlas" }],
    });
    expect(result.provider).toBe("mock");
    expect(result.modelId).toBe("mock-general");
    expect(result.text).toContain("hello atlas");

    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "stream me" }],
    })) {
      if (!chunk.done) {
        chunks.push(chunk.text);
      }
    }
    expect(chunks.join("")).toContain("stream me");

    await provider.unload();
    await expect(
      provider.generate({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toBeInstanceOf(AiRuntimeError);
  });
});

describe("InferenceProviderRegistry + AiRuntime", () => {
  it("switches providers and works with the mock by default", async () => {
    const registry = new InferenceProviderRegistry();
    const runtime = createAiRuntime({
      registry,
      provider: "mock",
      defaultModelId: "mock-general",
    });

    expect(runtime.listProviders()).toEqual(
      expect.arrayContaining(["mock", "llamacpp"]),
    );
    expect(runtime.getProviderId()).toBe("mock");

    const health = await runtime.health();
    expect(health.ok).toBe(true);

    await runtime.loadModel();
    const result = await runtime.generate({
      messages: [{ role: "user", content: "ping" }],
    });
    expect(result.text).toContain("ping");

    runtime.useProvider("llamacpp");
    expect(runtime.getProviderId()).toBe("llamacpp");
    expect(runtime.getActiveModel()).toBeUndefined();
  });

  it("registers a custom stub provider for future runtimes", async () => {
    const registry = new InferenceProviderRegistry();
    const stub = {
      id: "onnx-stub",
      async health() {
        return {
          ok: true,
          provider: "onnx-stub",
          message: "stub",
          checkedAt: new Date().toISOString(),
        };
      },
      async listModels() {
        return [];
      },
      async load(modelId: string) {
        return {
          id: modelId,
          name: modelId,
          format: "onnx" as const,
          provider: "onnx-stub",
          status: "loaded" as const,
        };
      },
      async unload() {},
      async generate() {
        return {
          text: "onnx",
          modelId: "x",
          provider: "onnx-stub",
          durationMs: 0,
        };
      },
      async *stream() {
        yield { text: "", done: true };
      },
    };
    registry.register(stub);
    expect(registry.ids()).toContain("onnx-stub");
    expect(registry.require("onnx-stub").id).toBe("onnx-stub");
  });
});

describe("LlamaCppProvider", () => {
  it("reports health ok when /health succeeds", async () => {
    const provider = new LlamaCppProvider({
      baseUrl: "http://127.0.0.1:9999",
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return new Response("ok", { status: 200 });
        }
        return new Response("not found", { status: 404 });
      },
    });

    const health = await provider.health();
    expect(health.ok).toBe(true);
    expect(health.endpoint).toBe("http://127.0.0.1:9999");
  });

  it("reports unreachable when fetch fails", async () => {
    const provider = new LlamaCppProvider({
      baseUrl: "http://127.0.0.1:9999",
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    const health = await provider.health();
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/unreachable|ECONNREFUSED/i);
  });

  it("generates via OpenAI-compatible chat completions", async () => {
    const provider = new LlamaCppProvider({
      baseUrl: "http://llama.test",
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return new Response("ok", { status: 200 });
        }
        if (url.endsWith("/v1/models")) {
          return Response.json({ data: [{ id: "qwen-local" }] });
        }
        if (url.endsWith("/v1/chat/completions")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            model: string;
            stream?: boolean;
          };
          expect(body.model).toBe("qwen-local");
          expect(body.stream).toBe(false);
          return Response.json({
            choices: [
              {
                message: { content: "Local reply" },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 3,
              completion_tokens: 2,
              total_tokens: 5,
            },
          });
        }
        return new Response("no", { status: 404 });
      },
    });

    await provider.load("qwen-local");
    const result = await provider.generate({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("Local reply");
    expect(result.provider).toBe("llamacpp");
    expect(result.usage?.totalTokens).toBe(5);
  });

  it("streams SSE chat completion chunks", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    const provider = new LlamaCppProvider({
      baseUrl: "http://llama.test",
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return new Response("ok", { status: 200 });
        }
        if (url.endsWith("/v1/models")) {
          return Response.json({ data: [{ id: "m" }] });
        }
        return new Response(sse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
    });

    await provider.load("m");
    const parts: string[] = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "x" }],
    })) {
      if (!chunk.done) {
        parts.push(chunk.text);
      }
    }
    expect(parts.join("")).toBe("Hello");
  });
});
