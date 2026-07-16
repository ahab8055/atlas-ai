/**
 * Register built-in inference providers in one place so new engines
 * can be added without editing AiRuntime internals.
 */
import type { InferenceProvider } from "../provider.js";
import type { InferenceProviderRegistry } from "../registry.js";
import type { HardwareProfile } from "../hardware.js";
import type { InferenceParams } from "../inference-params.js";
import {
  CloudStubInferenceProvider,
  type CloudStubInferenceProviderOptions,
} from "./cloud-stub.js";
import { LlamaCppProvider, type LlamaCppProviderOptions } from "./llamacpp.js";
import { MockInferenceProvider } from "./mock.js";

export interface RegisterBuiltinProvidersOptions {
  /** When set, use these instead of constructing builtins. */
  providers?: InferenceProvider[];
  llamaCpp?: LlamaCppProviderOptions;
  /** Feature gates for optional cloud stub. */
  features?: {
    cloudProviders?: boolean;
    offlineMode?: boolean;
  };
  cloudStub?: CloudStubInferenceProviderOptions;
  /** Pass through for llama defaults from Atlas config. */
  inference?: Partial<InferenceParams>;
  hardware?: Partial<HardwareProfile>;
}

/**
 * Register mock + llamacpp always; cloud-stub only when
 * cloudProviders=true and offlineMode=false.
 */
export function registerBuiltinProviders(
  registry: InferenceProviderRegistry,
  options: RegisterBuiltinProvidersOptions = {},
): InferenceProvider[] {
  const cloudProviders = options.features?.cloudProviders === true;
  const offlineMode = options.features?.offlineMode === true;

  const builtins: InferenceProvider[] = options.providers ?? [
    new MockInferenceProvider(),
    new LlamaCppProvider({
      ...options.llamaCpp,
      inference: options.inference ?? options.llamaCpp?.inference,
      hardware: options.hardware ?? options.llamaCpp?.hardware,
    }),
    ...(cloudProviders && !offlineMode
      ? [
          new CloudStubInferenceProvider({
            enabled: true,
            offlineMode: false,
            apiKeyPresent: options.cloudStub?.apiKeyPresent,
            ...options.cloudStub,
          }),
        ]
      : []),
  ];

  for (const provider of builtins) {
    registry.register(provider, { replace: true });
  }
  return builtins;
}
