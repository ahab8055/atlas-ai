/**
 * PlatformError — stable error codes for OS capability failures (ADR-0062).
 */

export type PlatformErrorCode =
  "not_implemented" | "unsupported" | "invalid_input" | "io_error";

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;

  constructor(code: PlatformErrorCode, message: string) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
  }
}

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}
