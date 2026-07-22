/**
 * Product file-system change events (ADR-0084).
 * Published via optional callback — no dependency on @atlas-ai/core EventBus.
 */

export const FILE_SYSTEM_EVENTS = [
  "FileCreated",
  "FileUpdated",
  "FileDeleted",
  "FileRenamed",
  "FolderChanged",
] as const;

export type FileSystemEventType = (typeof FILE_SYSTEM_EVENTS)[number];

export interface FileSystemEventBase {
  path: string;
  isDirectory: boolean;
  watchId: string;
  root: string;
}

export interface FileSystemEventPayloadMap {
  FileCreated: FileSystemEventBase;
  FileUpdated: FileSystemEventBase;
  FileDeleted: FileSystemEventBase;
  FileRenamed: FileSystemEventBase & { from: string; to: string };
  FolderChanged: FileSystemEventBase;
}

export interface FileSystemEventPublisher {
  publish<T extends FileSystemEventType>(
    type: T,
    payload: FileSystemEventPayloadMap[T],
    options?: { traceId?: string },
  ): void;
}

export function emitFileSystemEvent<T extends FileSystemEventType>(
  publisher: FileSystemEventPublisher | undefined,
  type: T,
  payload: FileSystemEventPayloadMap[T],
  options?: { traceId?: string },
): void {
  publisher?.publish(type, payload, options);
}

export function isFileSystemEventType(
  type: string,
): type is FileSystemEventType {
  return (FILE_SYSTEM_EVENTS as readonly string[]).includes(type);
}
