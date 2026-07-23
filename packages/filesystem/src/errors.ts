/**
 * Standardized file-system errors (ADR-0090).
 * Extends PlatformError with product kinds; builds Atlas-shaped payloads
 * without importing @atlas-ai/core (tools ↔ core cycle).
 */
import {
  PlatformError,
  isPlatformError,
  type PlatformErrorCode,
  type PlatformErrorDetail,
} from "@atlas-ai/platform";

export type FileSystemErrorKind =
  | "permission_denied"
  | "file_not_found"
  | "invalid_path"
  | "unsupported_type"
  | "disk_full"
  | "unknown";

/** AtlasErrorResponse-compatible category. */
export type AtlasFsErrorCategory = "user" | "tool" | "system" | "ai";

export type AtlasFsErrorCode =
  | "fs_permission_denied"
  | "fs_file_not_found"
  | "fs_invalid_path"
  | "fs_unsupported_type"
  | "fs_disk_full"
  | "fs_unknown";

export interface AtlasFsRecoveryAction {
  strategy:
    "retry" | "ask_user" | "use_alternative" | "notify" | "skip" | "none";
  description: string;
  attempted?: boolean;
  succeeded?: boolean;
}

/** AtlasErrorResponse-compatible plain object (ADR-0020 shape). */
export interface AtlasFileSystemErrorObject {
  id: string;
  category: AtlasFsErrorCategory;
  code: AtlasFsErrorCode;
  message: string;
  userMessage: string;
  recoverable: boolean;
  recovery: AtlasFsRecoveryAction[];
  cause?: string;
  context?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
}

export interface CreateFileSystemErrorOptions {
  approvalId?: string;
  detail?: PlatformErrorDetail;
  cause?: unknown;
}

const KIND_TO_PLATFORM: Record<FileSystemErrorKind, PlatformErrorCode> = {
  permission_denied: "permission_denied",
  file_not_found: "resource_not_found",
  invalid_path: "invalid_input",
  unsupported_type: "unsupported",
  disk_full: "disk_full",
  unknown: "unknown",
};

const KIND_TO_ATLAS_CODE: Record<FileSystemErrorKind, AtlasFsErrorCode> = {
  permission_denied: "fs_permission_denied",
  file_not_found: "fs_file_not_found",
  invalid_path: "fs_invalid_path",
  unsupported_type: "fs_unsupported_type",
  disk_full: "fs_disk_full",
  unknown: "fs_unknown",
};

const USER_MESSAGES: Record<FileSystemErrorKind, string> = {
  permission_denied: "Permission denied for this file operation.",
  file_not_found: "The file or path was not found.",
  invalid_path: "The path is invalid or not allowed for this operation.",
  unsupported_type: "This file type is not supported for this operation.",
  disk_full: "Disk is full or the storage quota was exceeded.",
  unknown: "An unexpected file system error occurred.",
};

function categoryForKind(kind: FileSystemErrorKind): AtlasFsErrorCategory {
  switch (kind) {
    case "permission_denied":
    case "invalid_path":
      return "user";
    case "file_not_found":
    case "unsupported_type":
      return "tool";
    case "disk_full":
    case "unknown":
      return "system";
  }
}

function recoveryForKind(kind: FileSystemErrorKind): AtlasFsRecoveryAction[] {
  switch (kind) {
    case "permission_denied":
      return [
        {
          strategy: "ask_user",
          description: "Grant filesystem permission or choose another path.",
        },
      ];
    case "file_not_found":
      return [
        {
          strategy: "ask_user",
          description: "Check the path or create the file first.",
        },
      ];
    case "invalid_path":
      return [
        {
          strategy: "ask_user",
          description: "Correct the path and retry.",
        },
      ];
    case "unsupported_type":
      return [
        {
          strategy: "use_alternative",
          description: "Use a supported text/format file instead.",
        },
      ];
    case "disk_full":
      return [
        {
          strategy: "ask_user",
          description: "Free disk space or change the write destination.",
        },
        { strategy: "retry", description: "Retry after freeing space." },
      ];
    case "unknown":
      return [
        { strategy: "retry", description: "Retry the file operation." },
        { strategy: "notify", description: "Report the unexpected error." },
      ];
  }
}

function newErrorId(): string {
  return `fserr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class FileSystemError extends PlatformError {
  readonly kind: FileSystemErrorKind;

  constructor(
    kind: FileSystemErrorKind,
    message: string,
    options?: CreateFileSystemErrorOptions,
  ) {
    const detail: PlatformErrorDetail = {
      ...options?.detail,
      fsKind: kind,
    };
    super(KIND_TO_PLATFORM[kind], message, {
      approvalId: options?.approvalId,
      detail,
      cause: options?.cause,
    });
    this.name = "FileSystemError";
    this.kind = kind;
  }
}

export function createFileSystemError(
  kind: FileSystemErrorKind,
  message: string,
  options?: CreateFileSystemErrorOptions,
): FileSystemError {
  return new FileSystemError(kind, message, options);
}

export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

/**
 * Map a PlatformError (including FileSystemError) into a product FS kind.
 */
export function kindFromPlatformError(
  error: PlatformError,
): FileSystemErrorKind {
  if (isFileSystemError(error)) {
    return error.kind;
  }
  const tagged = error.detail?.fsKind;
  if (
    tagged === "permission_denied" ||
    tagged === "file_not_found" ||
    tagged === "invalid_path" ||
    tagged === "unsupported_type" ||
    tagged === "disk_full" ||
    tagged === "unknown"
  ) {
    return tagged;
  }
  switch (error.code) {
    case "permission_denied":
      return "permission_denied";
    case "resource_not_found":
      return "file_not_found";
    case "invalid_input":
      return "invalid_path";
    case "unsupported":
      return "unsupported_type";
    case "disk_full":
      return "disk_full";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

/**
 * Normalize PlatformError into FileSystemError (preserves FileSystemError).
 */
export function fromPlatformErrorForFs(error: PlatformError): FileSystemError {
  if (isFileSystemError(error)) {
    return error;
  }
  return createFileSystemError(kindFromPlatformError(error), error.message, {
    approvalId: error.approvalId,
    detail: error.detail,
    cause: error.cause ?? error,
  });
}

/**
 * Build an AtlasErrorResponse-compatible object for tools / pipeline.
 */
export function toAtlasFileSystemError(
  error: FileSystemError | PlatformError,
): AtlasFileSystemErrorObject {
  const fsError = isFileSystemError(error)
    ? error
    : isPlatformError(error)
      ? fromPlatformErrorForFs(error)
      : createFileSystemError("unknown", String(error));
  const kind = fsError.kind;
  const atlasCode = KIND_TO_ATLAS_CODE[kind];
  return {
    id: newErrorId(),
    category: categoryForKind(kind),
    code: atlasCode,
    message: fsError.message,
    userMessage: USER_MESSAGES[kind],
    recoverable: kind !== "unknown",
    recovery: recoveryForKind(kind),
    cause: fsError.cause instanceof Error ? fsError.cause.message : undefined,
    context: {
      fsKind: kind,
      platformCode: fsError.code,
      platformCategory: fsError.category,
      ...(fsError.approvalId !== undefined
        ? { approvalId: fsError.approvalId }
        : {}),
      ...(fsError.detail !== undefined ? { detail: fsError.detail } : {}),
    },
    timestamp: new Date().toISOString(),
  };
}
