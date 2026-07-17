/**
 * Memory errors — keep codes stable for CLI / logging later.
 */
export type MemoryErrorCode =
  | "provider_exists"
  | "provider_not_found"
  | "memory_not_found"
  | "invalid_input";

export class MemoryError extends Error {
  readonly code: MemoryErrorCode;
  readonly type?: string;

  constructor(
    message: string,
    options: { code: MemoryErrorCode; type?: string; cause?: unknown } = {
      code: "invalid_input",
    },
  ) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "MemoryError";
    this.code = options.code;
    this.type = options.type;
  }

  static providerNotFound(type: string): MemoryError {
    return new MemoryError(`Memory provider not registered for type: ${type}`, {
      code: "provider_not_found",
      type,
    });
  }

  static notFound(id: string): MemoryError {
    return new MemoryError(`Memory not found: ${id}`, {
      code: "memory_not_found",
    });
  }
}
