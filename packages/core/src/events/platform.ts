import type {
  PlatformEventPayloadMap,
  PlatformEventPublisher,
  PlatformEventType,
} from "@atlas-ai/platform";

import type { EventBus } from "./bus.js";
import type { PublishInput } from "./types.js";
import { PLATFORM_EVENTS } from "@atlas-ai/platform";

const PLATFORM_SOURCE = "atlas.platform";

export { PLATFORM_EVENTS };
export type {
  PlatformEventPayloadMap,
  PlatformEventPublisher,
  PlatformEventType,
} from "@atlas-ai/platform";

export function isPlatformEventType(type: string): type is PlatformEventType {
  return (PLATFORM_EVENTS as readonly string[]).includes(type);
}

/**
 * Publish a typed platform event onto the shared EventBus.
 */
export function publishPlatformEvent<T extends PlatformEventType>(
  bus: EventBus,
  type: T,
  payload: PlatformEventPayloadMap[T],
  options: { traceId?: string; source?: string } = {},
): void {
  const input: PublishInput<T, PlatformEventPayloadMap[T]> = {
    type,
    source: options.source ?? PLATFORM_SOURCE,
    payload,
    traceId: options.traceId,
  };
  bus.publish(input);
}

/**
 * Bridge platform emit callback → EventBus (composition root / CLI).
 */
export function createPlatformEventPublisher(
  bus: EventBus,
): PlatformEventPublisher {
  return {
    publish(type, payload, options) {
      publishPlatformEvent(bus, type, payload, options);
    },
  };
}
