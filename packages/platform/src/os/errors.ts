/**
 * PlatformError — stable error codes for OS capability failures (ADR-0062 / 0066).
 */

export type PlatformErrorCode =
  | "not_implemented"
  | "unsupported"
  | "invalid_input"
  | "io_error"
  | "permission_denied";

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  /** Pending approval id when blocked (future Permission Center / dialogs). */
  readonly approvalId?: string;

  constructor(
    code: PlatformErrorCode,
    message: string,
    options?: { approvalId?: string },
  ) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
    this.approvalId = options?.approvalId;
  }
}

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}
