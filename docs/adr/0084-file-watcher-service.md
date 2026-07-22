# ADR-0084: File watcher service

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

Architecture/24 Change Detection needs create/update/delete (and folder)
signals for incremental indexing. Product FS was request/response only;
watchers were listed out of scope. Users need reliable FS events on the Atlas
EventBus without coupling `@atlas-ai/platform` to core.

## Decision

1. Add `FileSystemService.watch` (Node `fs.watch`, recursive default) with
   broker gate `filesystem.read`. No new watcher npm deps.
2. Product `FileWatcherService` (`watchDirectory` / `stop`) enforces roots,
   deny list, and `filesystem.read`; debounces; normalizes to
   `FileCreated` / `FileUpdated` / `FileDeleted` / `FileRenamed` /
   `FolderChanged`; best-effort rename correlator (delete+create same parent).
3. Events emit via optional `FileSystemEventPublisher` (filesystem package).
   Core `createFileSystemEventPublisher(bus)` bridges to EventBus
   (`source: "atlas.filesystem"`), same pattern as ADR-0069.
4. CLI bootstraps the watcher with the publisher but does **not** auto-watch
   cwd — callers start watches explicitly.

## Consequences

### Positive

- Subscribers receive typed FS change events on the shared bus.
- OS backend stays swappable (future Tauri) behind `os.files.watch`.

### Negative / trade-offs

- Native `fs.watch` quirks (rename as create/delete; EMFILE under load).
- No chokidar / `@parcel/watcher`; no auto-index consumer yet.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Event-System.md](../guides/Event-System.md)
- [ADR-0069](./0069-platform-event-integration.md)
- [ADR-0074](./0074-file-system-access-service.md)
