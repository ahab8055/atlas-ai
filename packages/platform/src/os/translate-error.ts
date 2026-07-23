/**
 * Map native Node / OS errors into standardized PlatformError (ADR-0068).
 */
import {
  PlatformError,
  type PlatformErrorCode,
  type PlatformErrorDetail,
} from "./errors.js";

export interface TranslateNativeErrorContext {
  operation: string;
  path?: string;
  platform?: string;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  );
}

function codeFromErrno(errno: string | undefined): PlatformErrorCode {
  switch (errno) {
    case "ENOENT":
      return "resource_not_found";
    case "EACCES":
    case "EPERM":
      return "permission_denied";
    case "ENOTSUP":
    case "EOPNOTSUPP":
      return "unsupported";
    case "ENOSPC":
    case "EDQUOT":
      return "disk_full";
    default:
      return "io_error";
  }
}

/**
 * Translate a native thrown value into PlatformError with diagnostics preserved.
 */
export function translateNativeError(
  error: unknown,
  context: TranslateNativeErrorContext,
): PlatformError {
  if (error instanceof PlatformError) {
    return error;
  }

  if (!error || (typeof error !== "object" && typeof error !== "string")) {
    return new PlatformError(
      "unknown",
      `${context.operation} failed with an unknown error`,
      {
        cause: error,
        detail: {
          path: context.path,
          platform: context.platform,
        },
      },
    );
  }

  if (isErrnoException(error)) {
    const errno = error.code;
    const code = codeFromErrno(errno);
    const nativeMessage = error.message || String(error);
    const detail: PlatformErrorDetail = {
      errno,
      syscall: error.syscall,
      path: context.path ?? error.path,
      platform: context.platform,
    };
    return new PlatformError(
      code,
      `${context.operation} failed: ${nativeMessage}`,
      { cause: error, detail },
    );
  }

  if (error instanceof Error) {
    return new PlatformError(
      "io_error",
      `${context.operation} failed: ${error.message}`,
      {
        cause: error,
        detail: {
          path: context.path,
          platform: context.platform,
        },
      },
    );
  }

  return new PlatformError(
    "unknown",
    `${context.operation} failed: ${String(error)}`,
    {
      cause: error,
      detail: {
        path: context.path,
        platform: context.platform,
      },
    },
  );
}
