const SENSITIVE_KEY =
  /(pass(word)?|secret|token|api[_-]?key|authorization|credential|cookie)/i;

/**
 * Shallow-redact sensitive fields before logging.
 * Never log raw secrets (see Security Architecture / config secrets rules).
 */
export function redactContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      result[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactContext(value as Record<string, unknown>);
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function toLogError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "NonError",
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}
