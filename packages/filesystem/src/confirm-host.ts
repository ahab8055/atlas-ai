/**
 * Optional host for confirming FileAccessService permission blocks (ADR-0083).
 */
import { isPlatformError } from "@atlas-ai/platform";
import type { PermissionManager } from "@atlas-ai/security";

import { isDestructiveFsOperation } from "./safe-ops.js";

export interface FsConfirmRequest {
  approvalId: string;
  capability: string;
  reason: string;
  resource?: string;
  message: string;
  destructive: boolean;
}

export type FsConfirmHandler = (request: FsConfirmRequest) => boolean;

let confirmHandler: FsConfirmHandler | undefined;
let confirmPermissions: PermissionManager | undefined;

export function configureFsConfirmHost(options: {
  permissions: PermissionManager;
  confirm: FsConfirmHandler;
}): void {
  confirmPermissions = options.permissions;
  confirmHandler = options.confirm;
}

export function clearFsConfirmHost(): void {
  confirmPermissions = undefined;
  confirmHandler = undefined;
}

/**
 * Run fn; on permission_denied with approvalId, ask host once, resolve one-shot
 * or session grant, and retry once.
 */
export function withFsConfirmRetry<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (
      !confirmHandler ||
      !confirmPermissions ||
      !isPlatformError(error) ||
      error.code !== "permission_denied" ||
      !error.approvalId
    ) {
      throw error;
    }

    const pending = confirmPermissions.approvals.get(error.approvalId);
    if (!pending || pending.status !== "pending") {
      throw error;
    }

    const destructive = isDestructiveFsOperation(pending.request.reason);
    const approved = confirmHandler({
      approvalId: error.approvalId,
      capability: pending.request.capability,
      reason: pending.request.reason,
      resource: pending.request.resource,
      message: pending.summary,
      destructive,
    });
    if (!approved) {
      throw error;
    }

    confirmPermissions.resolveApproval(error.approvalId, "approved", {
      sessionGrant: !destructive,
    });

    return fn();
  }
}
