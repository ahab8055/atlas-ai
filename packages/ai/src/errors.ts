/**
 * Errors from the AI runtime layer (map to core `ai` category later).
 */
export class AiRuntimeError extends Error {
  readonly code: string;
  readonly provider?: string;

  constructor(
    message: string,
    options: { code?: string; provider?: string; cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "AiRuntimeError";
    this.code = options.code ?? "ai_error";
    this.provider = options.provider;
  }

  static notFound(providerId: string): AiRuntimeError {
    return new AiRuntimeError(`Unknown inference provider: ${providerId}`, {
      code: "provider_not_found",
      provider: providerId,
    });
  }

  static modelNotLoaded(providerId: string): AiRuntimeError {
    return new AiRuntimeError("No model loaded. Call loadModel first.", {
      code: "model_not_loaded",
      provider: providerId,
    });
  }

  static unreachable(providerId: string, detail: string): AiRuntimeError {
    return new AiRuntimeError(detail, {
      code: "runtime_unreachable",
      provider: providerId,
    });
  }
}
