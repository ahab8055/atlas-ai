import { describe, expect, it } from "vitest";

import {
  CloudStubInferenceProvider,
  InferenceProviderRegistry,
  MockInferenceProvider,
  createAiRuntime,
  registerBuiltinProviders,
  type InferenceProvider,
  type GenerateRequest,
  type GenerateResult,
  type ModelInfo,
  type RuntimeHealth,
  type StreamChunk,
} from "../index.js";

describe("provider descriptors", () => {
  it("tags mock and llamacpp as local", () => {
    const registry = new InferenceProviderRegistry();
    registerBuiltinProviders(registry);
    expect(registry.require("mock").meta?.kind).toBe("local");
    expect(registry.require("mock").meta?.requiresNetwork).toBe(false);
    expect(registry.require("llamacpp").meta?.kind).toBe("local");
    expect(registry.require("llamacpp").meta?.requiresNetwork).toBe(false);
    expect(registry.get("cloud-stub")).toBeUndefined();
  });

  it("registers cloud stub only when cloud on and offline off", () => {
    const registry = new InferenceProviderRegistry();
    registerBuiltinProviders(registry, {
      features: { cloudProviders: true, offlineMode: false },
    });
    const stub = registry.require("cloud-stub");
    expect(stub.meta?.kind).toBe("cloud");
    expect(stub.meta?.requiresNetwork).toBe(true);
  });
});

describe("CloudStubInferenceProvider", () => {
  it("blocks when offlineMode or cloudProviders off", async () => {
    const offline = new CloudStubInferenceProvider({
      enabled: true,
      offlineMode: true,
    });
    await expect(
      offline.generate({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "offline_blocked" });

    const disabled = new CloudStubInferenceProvider({
      enabled: false,
      offlineMode: false,
    });
    await expect(disabled.load("x")).rejects.toMatchObject({
      code: "cloud_disabled",
    });
  });

  it("returns cloud_not_configured when allowed but no real client", async () => {
    const stub = new CloudStubInferenceProvider({
      enabled: true,
      offlineMode: false,
      apiKeyPresent: true,
    });
    await expect(
      stub.generate({
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toMatchObject({ code: "cloud_not_configured" });
  });
});

describe("pluggable custom provider", () => {
  it("adds a provider without changing AiRuntime", async () => {
    const custom: InferenceProvider = {
      id: "custom-echo",
      meta: {
        kind: "local",
        requiresNetwork: false,
        label: "Custom echo",
      },
      async health(): Promise<RuntimeHealth> {
        return {
          ok: true,
          provider: "custom-echo",
          message: "ok",
          checkedAt: new Date().toISOString(),
        };
      },
      async listModels(): Promise<ModelInfo[]> {
        return [
          {
            id: "echo",
            name: "Echo",
            format: "unknown",
            provider: "custom-echo",
            status: "available",
          },
        ];
      },
      async load(modelId: string): Promise<ModelInfo> {
        return {
          id: modelId,
          name: modelId,
          format: "unknown",
          provider: "custom-echo",
          status: "loaded",
        };
      },
      async unload(): Promise<void> {},
      async generate(req: GenerateRequest): Promise<GenerateResult> {
        const last = [...req.messages].reverse().find((m) => m.role === "user");
        return {
          text: `echo: ${last?.content ?? ""}`,
          modelId: "echo",
          provider: "custom-echo",
          durationMs: 0,
        };
      },
      async *stream(): AsyncIterable<StreamChunk> {
        yield { text: "", done: true };
      },
    };

    const registry = new InferenceProviderRegistry();
    registry.register(new MockInferenceProvider());
    registry.register(custom);

    const runtime = createAiRuntime({
      registry,
      providers: [new MockInferenceProvider(), custom],
      provider: "custom-echo",
      defaultModelId: "echo",
    });

    expect(runtime.getProviderId()).toBe("custom-echo");
    await runtime.loadModel("echo");
    const result = await runtime.generate({
      messages: [{ role: "user", content: "plug-in" }],
    });
    expect(result.text).toContain("plug-in");
    expect(result.provider).toBe("custom-echo");
  });
});
