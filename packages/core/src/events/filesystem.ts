/**
 * Bridge FileSystemEventPublisher → EventBus (ADR-0084).
 */
import {
  FILE_SYSTEM_EVENTS,
  type FileSystemEventPayloadMap,
  type FileSystemEventPublisher,
  type FileSystemEventType,
} from "@atlas-ai/filesystem";

import type { EventBus } from "./bus.js";
import type { PublishInput } from "./types.js";

const FILESYSTEM_SOURCE = "atlas.filesystem";

export { FILE_SYSTEM_EVENTS };
export type {
  FileSystemEventPayloadMap,
  FileSystemEventPublisher,
  FileSystemEventType,
} from "@atlas-ai/filesystem";

export function isFileSystemEventType(
  type: string,
): type is FileSystemEventType {
  return (FILE_SYSTEM_EVENTS as readonly string[]).includes(type);
}

/**
 * Publish a typed filesystem change event onto the shared EventBus.
 */
export function publishFileSystemEvent<T extends FileSystemEventType>(
  bus: EventBus,
  type: T,
  payload: FileSystemEventPayloadMap[T],
  options: { traceId?: string; source?: string } = {},
): void {
  const input: PublishInput<T, FileSystemEventPayloadMap[T]> = {
    type,
    source: options.source ?? FILESYSTEM_SOURCE,
    payload,
    traceId: options.traceId,
  };
  bus.publish(input as unknown as PublishInput);
}

/**
 * Bridge filesystem emit callback → EventBus (composition root / CLI).
 */
export function createFileSystemEventPublisher(
  bus: EventBus,
): FileSystemEventPublisher {
  return {
    publish(type, payload, options) {
      publishFileSystemEvent(bus, type, payload, options);
    },
  };
}
