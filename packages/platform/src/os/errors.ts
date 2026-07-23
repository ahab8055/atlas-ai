/**
 * PlatformError — stable error codes for OS capability failures
 * (ADR-0062 / 0066 / 0068).
 */

export type PlatformErrorCategory =
  "permission" | "resource" | "system" | "unknown";

export type PlatformErrorCode =
  | "not_implemented"
  | "unsupported"
  | "invalid_input"
  | "io_error"
  | "disk_full"
  | "permission_denied"
  | "resource_not_found"
  | "unknown";

export interface PlatformErrorDetail {
  /** Node errno string, e.g. ENOENT, EACCES. */
  errno?: string;
  syscall?: string;
  path?: string;
  /** Host platform id when known: darwin | linux | win32. */
  platform?: string;
  exitCode?: number | null;
  stderr?: string;
  /** Product FS error kind when tagged (ADR-0090). */
  fsKind?: string;
}

export interface PlatformErrorOptions {
  approvalId?: string;
  category?: PlatformErrorCategory;
  detail?: PlatformErrorDetail;
  cause?: unknown;
}

/** Map PlatformErrorCode → PlatformErrorCategory. */
export function categoryForPlatformCode(
  code: PlatformErrorCode,
): PlatformErrorCategory {
  switch (code) {
    case "permission_denied":
      return "permission";
    case "resource_not_found":
      return "resource";
    case "io_error":
    case "disk_full":
    case "not_implemented":
    case "unsupported":
      return "system";
    case "invalid_input":
    case "unknown":
      return "unknown";
  }
}

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  readonly category: PlatformErrorCategory;
  /** Pending approval id when blocked (future Permission Center / dialogs). */
  readonly approvalId?: string;
  readonly detail?: PlatformErrorDetail;
  override readonly cause?: unknown;

  constructor(
    code: PlatformErrorCode,
    message: string,
    options?: PlatformErrorOptions,
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "PlatformError";
    this.code = code;
    this.category = options?.category ?? categoryForPlatformCode(code);
    this.approvalId = options?.approvalId;
    this.detail = options?.detail;
    this.cause = options?.cause;
  }
}

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}
