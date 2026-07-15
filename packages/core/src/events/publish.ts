import type { EventBus } from "./bus.js";
import type {
  AtlasEvent,
  CoreAtlasEvent,
  CoreEventPayloadMap,
  CoreEventType,
  PublishInput,
} from "./types.js";
import { CORE_EVENTS } from "./types.js";

const PIPELINE_SOURCE = "atlas.pipeline";

export function isCoreEventType(type: string): type is CoreEventType {
  return (CORE_EVENTS as readonly string[]).includes(type);
}

/**
 * Publish a typed core orchestration event.
 */
export function publishCoreEvent<T extends CoreEventType>(
  bus: EventBus,
  type: T,
  payload: CoreEventPayloadMap[T],
  options: { traceId?: string; source?: string } = {},
): CoreAtlasEvent<T> {
  const input: PublishInput<T, CoreEventPayloadMap[T]> = {
    type,
    source: options.source ?? PIPELINE_SOURCE,
    payload,
    traceId: options.traceId,
  };
  return bus.publish(input) as CoreAtlasEvent<T>;
}

export function assertAtlasEvent(value: unknown): asserts value is AtlasEvent {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as AtlasEvent).id !== "string" ||
    typeof (value as AtlasEvent).type !== "string" ||
    typeof (value as AtlasEvent).timestamp !== "string" ||
    typeof (value as AtlasEvent).source !== "string" ||
    typeof (value as AtlasEvent).payload !== "object" ||
    (value as AtlasEvent).payload === null
  ) {
    throw new Error("Invalid AtlasEvent structure");
  }
}
