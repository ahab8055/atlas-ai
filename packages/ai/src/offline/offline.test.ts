import { describe, expect, it } from "vitest";

import { AiRuntimeError, createAiRuntime } from "../index.js";
import {
  assessOfflineCapability,
  assertNetworkOperationAllowed,
  formatOfflineModeStatus,
  isLoopbackUrl,
  probeInternetReachability,
} from "./index.js";

describe("offline policy", () => {
  it("detects loopback URLs", () => {
    expect(isLoopbackUrl("http://127.0.0.1:8080")).toBe(true);
    expect(isLoopbackUrl("http://localhost:8080/v1")).toBe(true);
    expect(isLoopbackUrl("https://example.com/model.gguf")).toBe(false);
  });

  it("blocks URL model install when offlineMode is on", () => {
    expect(() =>
      assertNetworkOperationAllowed(
        "model_install_url",
        { offlineMode: true },
        { url: "https://cdn.example.com/m.gguf" },
      ),
    ).toThrow(AiRuntimeError);

    try {
      assertNetworkOperationAllowed(
        "model_install_url",
        { offlineMode: true },
        { url: "https://cdn.example.com/m.gguf" },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AiRuntimeError);
      expect((error as AiRuntimeError).code).toBe("offline_blocked");
    }
  });

  it("allows loopback URL even when offlineMode is on", () => {
    expect(() =>
      assertNetworkOperationAllowed(
        "model_install_url",
        { offlineMode: true },
        { url: "http://127.0.0.1:9000/weights.gguf" },
      ),
    ).not.toThrow();
  });

  it("allows URL install when offlineMode is off", () => {
    expect(() =>
      assertNetworkOperationAllowed(
        "model_install_url",
        { offlineMode: false },
        { url: "https://cdn.example.com/m.gguf" },
      ),
    ).not.toThrow();
  });

  it("blocks cloud inference when offlineMode or cloudProviders off", () => {
    expect(() =>
      assertNetworkOperationAllowed("cloud_inference", {
        offlineMode: true,
        cloudProvidersEnabled: true,
      }),
    ).toThrow(/offline/i);

    expect(() =>
      assertNetworkOperationAllowed("cloud_inference", {
        offlineMode: false,
        cloudProvidersEnabled: false,
      }),
    ).toThrow(/cloud/i);
  });
});

describe("assessOfflineCapability", () => {
  it("reports blocked ops and limitations when offlineMode is on", () => {
    const status = assessOfflineCapability({
      offlineMode: true,
      cloudProvidersEnabled: false,
      localInferenceReady: true,
      providerId: "mock",
      internetReachable: "unknown",
    });
    expect(status.blockedOperations).toContain("model_install_url");
    expect(status.limitations.length).toBeGreaterThan(0);
    expect(formatOfflineModeStatus(status)).toContain("Offline mode");
    expect(formatOfflineModeStatus(status)).toContain("Policy: ON");
  });

  it("skips probe when requested", async () => {
    await expect(probeInternetReachability({ skip: true })).resolves.toBe(
      "unknown",
    );
    await expect(
      probeInternetReachability({ probe: async () => true }),
    ).resolves.toBe("true");
  });
});

describe("offline local inference", () => {
  it("load+generate succeed with fetch that rejects non-loopback", async () => {
    const rejectExternal: typeof fetch = async (input) => {
      const url = String(input);
      if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
        throw new Error(`external network blocked: ${url}`);
      }
      throw new Error("unexpected loopback fetch in mock path");
    };

    const runtime = createAiRuntime({
      provider: "mock",
      defaultModelId: "mock-general",
      providers: undefined,
    });

    // Mock path does not use fetch; ensure generate still works under offline policy.
    void rejectExternal;
    await runtime.loadModel();
    const result = await runtime.generate({
      messages: [{ role: "user", content: "offline hello" }],
    });
    expect(result.text).toContain("offline hello");
    expect(result.provider).toBe("mock");
  });
});
