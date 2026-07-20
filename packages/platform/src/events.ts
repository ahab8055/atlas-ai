/**
 * Platform lifecycle / permission / failure events (ADR-0069).
 * Published via optional callback — no dependency on @atlas-ai/core EventBus.
 */
import type { PlatformErrorDetail } from "./os/errors.js";
import type { PlatformId } from "./types.js";

export const PLATFORM_EVENTS = [
  "PlatformDetected",
  "PlatformServicesStarted",
  "PermissionDenied",
  "PlatformProviderFailed",
] as const;

export type PlatformEventType = (typeof PLATFORM_EVENTS)[number];

export interface PlatformEventPayloadMap {
  PlatformDetected: {
    platformId: PlatformId;
    os: string;
    arch: string;
  };
  PlatformServicesStarted: {
    platformId: PlatformId;
    via: "bootstrap" | "register" | "lazy";
  };
  PermissionDenied: {
    operation: string;
    capability: string;
    approvalId?: string;
    reason: string;
  };
  PlatformProviderFailed: {
    operation: string;
    code: string;
    category: string;
    message: string;
    /** Native / provider troubleshooting fields when available. */
    detail?: PlatformErrorDetail;
  };
}

export interface PlatformEventPublisher {
  publish<T extends PlatformEventType>(
    type: T,
    payload: PlatformEventPayloadMap[T],
    options?: { traceId?: string },
  ): void;
}

/** No-op when publisher is absent (tests / hosts without event bus). */
export function emitPlatformEvent<T extends PlatformEventType>(
  publisher: PlatformEventPublisher | undefined,
  type: T,
  payload: PlatformEventPayloadMap[T],
  options?: { traceId?: string },
): void {
  publisher?.publish(type, payload, options);
}

export function isPlatformEventType(type: string): type is PlatformEventType {
  return (PLATFORM_EVENTS as readonly string[]).includes(type);
}
