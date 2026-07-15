/**
 * Optional live probe against a running llama-server.
 * Skipped unless ATLAS_AI_ENDPOINT is set.
 */
import { describe, expect, it } from "vitest";
import { createAiRuntime, InferenceProviderRegistry } from "@atlas-ai/ai";

const endpoint = process.env.ATLAS_AI_ENDPOINT;

describe.skipIf(!endpoint)("AI runtime live llama.cpp", () => {
  it("reaches the configured local endpoint", async () => {
    const runtime = createAiRuntime({
      registry: new InferenceProviderRegistry(),
      provider: "llamacpp",
      endpoint,
      defaultModelId: process.env.ATLAS_AI_DEFAULT_MODEL ?? "local",
    });
    const health = await runtime.health();
    expect(health.provider).toBe("llamacpp");
    expect(health.ok).toBe(true);
  });
});
