/**
 * Optional cloud inference stub — prepares the provider port for future
 * OpenAI/Anthropic clients without shipping real cloud HTTP yet.
 */
import { AiRuntimeError } from "../errors.js";
import { assertNetworkOperationAllowed } from "../offline/policy.js";
import type { InferenceProvider, ProviderDescriptor } from "../provider.js";
import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "../types.js";

export interface CloudStubInferenceProviderOptions {
  /** features.cloudProviders */
  enabled?: boolean;
  /** features.offlineMode */
  offlineMode?: boolean;
  /** True when OPENAI_API_KEY / ANTHROPIC_API_KEY (or similar) is present. */
  apiKeyPresent?: boolean;
}

export class CloudStubInferenceProvider implements InferenceProvider {
  readonly id = "cloud-stub";
  readonly meta: ProviderDescriptor = {
    kind: "cloud",
    requiresNetwork: true,
    label: "Cloud stub (optional)",
    notes: "Placeholder for future cloud LLM clients — not a real backend",
  };

  private readonly enabled: boolean;
  private readonly offlineMode: boolean;
  private readonly apiKeyPresent: boolean;

  constructor(options: CloudStubInferenceProviderOptions = {}) {
    this.enabled = options.enabled === true;
    this.offlineMode = options.offlineMode === true;
    this.apiKeyPresent = options.apiKeyPresent === true;
  }

  private assertAllowed(): void {
    assertNetworkOperationAllowed("cloud_inference", {
      offlineMode: this.offlineMode,
      cloudProvidersEnabled: this.enabled,
    });
    if (!this.apiKeyPresent) {
      throw new AiRuntimeError(
        "Cloud inference is not configured. Real cloud clients are future work; " +
          "set API keys and implement a cloud provider when enabling features.cloudProviders.",
        { code: "cloud_not_configured", provider: this.id },
      );
    }
    // Keys present but no real HTTP client yet.
    throw new AiRuntimeError(
      "Cloud stub has no real backend yet. Implement an OpenAI/Anthropic " +
        "InferenceProvider and register it instead of cloud-stub.",
      { code: "cloud_not_configured", provider: this.id },
    );
  }

  async health(): Promise<RuntimeHealth> {
    try {
      assertNetworkOperationAllowed("cloud_inference", {
        offlineMode: this.offlineMode,
        cloudProvidersEnabled: this.enabled,
      });
      return {
        ok: false,
        provider: this.id,
        message: this.apiKeyPresent
          ? "Cloud stub registered but no real cloud client implemented"
          : "Cloud stub: API key missing / cloud_not_configured",
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        provider: this.id,
        message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: "cloud-stub/default",
        name: "Cloud stub (not configured)",
        format: "unknown",
        provider: this.id,
        status: "missing",
      },
    ];
  }

  async load(_modelId: string): Promise<ModelInfo> {
    this.assertAllowed();
    throw new AiRuntimeError("unreachable", {
      code: "cloud_not_configured",
      provider: this.id,
    });
  }

  async unload(): Promise<void> {
    // No resident cloud session in the stub.
  }

  async generate(_req: GenerateRequest): Promise<GenerateResult> {
    this.assertAllowed();
    throw new AiRuntimeError("unreachable", {
      code: "cloud_not_configured",
      provider: this.id,
    });
  }

  async *stream(_req: GenerateRequest): AsyncIterable<StreamChunk> {
    this.assertAllowed();
    yield { text: "", done: true, finishReason: "error" };
  }
}
