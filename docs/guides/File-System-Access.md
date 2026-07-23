# Atlas AI — File System Access

Product File System Access layer (Architecture/26 §3) on top of platform
`os.files`. Tools and agents use **`FileAccessService`**; they do not call
`node:fs` for this path.

Related: [Platform-Abstraction.md](./Platform-Abstraction.md),
[Tool-Registry.md](./Tool-Registry.md), [Security.md](./Security.md),
[CLI.md](./CLI.md), [ADR-0074](../adr/0074-file-system-access-service.md),
[ADR-0075](../adr/0075-directory-navigation.md),
[ADR-0076](../adr/0076-file-search-engine.md),
[ADR-0077](../adr/0077-file-metadata-service.md),
[ADR-0078](../adr/0078-file-reading-engine.md),
[ADR-0079](../adr/0079-file-writing-engine.md),
[ADR-0080](../adr/0080-directory-management.md),
[ADR-0081](../adr/0081-file-management-operations.md),
[ADR-0082](../adr/0082-file-permission-validation.md),
[ADR-0083](../adr/0083-safe-file-operations.md),
[ADR-0084](../adr/0084-file-watcher-service.md),
[ADR-0085](../adr/0085-recent-files-index.md),
[ADR-0086](../adr/0086-ignore-rules-engine.md),
[ADR-0087](../adr/0087-file-indexing-service.md),
[ADR-0088](../adr/0088-large-file-processing.md),
[ADR-0089](../adr/0089-file-type-detection.md),
[ADR-0090](../adr/0090-file-system-error-handling.md),
[`@atlas-ai/filesystem`](../../packages/filesystem/).

---

## Layering

| Layer   | Type                             | Role                                                      |
| ------- | -------------------------------- | --------------------------------------------------------- |
| Product | `FileAccessService`              | Search, CRUD, navigate, metadata, read/write, directories |
| Caps    | `PermissionManager` (optional)   | Capability gate before each public method (ADR-0082)      |
| Path    | `assertAllowed`                  | Roots + sensitive deny list                               |
| OS      | `FileSystemService` (`os.files`) | Path CRUD; broker wraps when platform enforces (ADR-0066) |

```ts
import {
  bootstrapFileAccessFromRegistry,
  createFileAccessService,
  getDefaultFileAccessService,
} from "@atlas-ai/filesystem";
import { getDefaultPlatformServiceRegistry } from "@atlas-ai/platform";

bootstrapFileAccessFromRegistry(getDefaultPlatformServiceRegistry(), {
  roots: [process.cwd()],
  permissions, // same PermissionManager as CLI / broker
  logger: logger.child("filesystem"),
});

const files = getDefaultFileAccessService();
files.writeFile("notes.txt", "hello");
const { hits, truncated, scannedEntries, durationMs } = files.findFiles({
  pattern: "*.ts",
  extensions: [".ts"],
  maxDepth: 6,
});
const tree = files.walkDirectory(".", { maxDepth: 4 });
```

---

## API

### CRUD (ADR-0074)

- `deleteFile(path)` — hard delete alias of `deletePath({ trash: false })`
- `moveFile(from, to)` — alias of `movePath` (prefer `movePath`)

### File management (ADR-0081)

- `copyPath(from, to, { createDirs?, overwrite?, recursive? })` → `CopyPathResult`
- `movePath` / `renamePath` — via platform `rename` (overwrite default false)
- `deletePath(path, { trash?, recursive? })` → `DeletePathResult`
  - `trash` default **true** → `{roots[0]}/.atlas/trash/{trashId}/`
  - `trash: false` → hard remove
- `restorePath(trashId)` → `RestorePathResult`

### Directory management (ADR-0080)

- `createDirectory(path, { recursive? })` → `{ path, created }`
- `directoryExists(path)` → boolean
- `pathExists(path)` → `{ exists, isFile, isDirectory }`
- `movePath(from, to, { createDirs?, overwrite? })` → `{ from, to, kind }`
  via platform `rename` (files and directories; same-volume)
- `deleteDirectory(path)` — **empty directories only**

### Writing engine (ADR-0079)

`writeFile(path, content, opts?)` → `WriteFileResult`:

```ts
{
  (path, bytesWritten, encoding, mode, atomic, created);
}
```

Options: `createDirs` (default true), `mode` (`create` | `overwrite` |
`append`, default overwrite), legacy `overwrite: false` → create, `encoding`
(`utf-8` | `utf-16le` | `utf-16be`), `atomic` (default true for
create/overwrite; false for append), `bom` (UTF-8 only; UTF-16 always BOM).

Atomic writes use temp `writeBytes` + `rename`. Atomic append rewrites under
`maxAtomicAppendBytes` (default 16 MiB); otherwise `appendBytes`.

### Reading engine (ADR-0078)

`readFile(path, opts?)` → `FileContent`:

```ts
{
  path, content, size,           // size = full file (stat)
  format, mimeType, encoding,    // utf-8 | utf-16le | utf-16be
  byteOffset, byteLength, truncated,
  data?,                         // JSON / YAML / CSV when parse succeeds
  parseError?,
  detectionSource?, extensionMismatch?,  // ADR-0089
}
```

Options: `offset` (default 0), `maxBytes` (default service maxReadBytes /
256 KiB), `parse` (default true). Large files use a byte window
(`truncated: true`); known binary types and binary-like content are rejected.
JSON / YAML / CSV are parsed safely (no new deps); Markdown / XML / source
return text + format only. Prefer chunk APIs below when walking multi-window
files. Format/MIME come from content-aware detection (ADR-0089), not extension
alone.

### File type detection (ADR-0089)

`detectFileType(path)` and helpers `detectFileType({ extension, bytes, sampleText })`
/ `sniffSignature(bytes)` merge:

1. Extension MIME/format maps
2. Magic-byte signatures (PNG, JPEG, GIF, WEBP, PDF, ZIP, GZIP) — always win
3. Light text heuristics (JSON / YAML / CSV / XML) when no binary magic

Binary signatures override wrong extensions. Text heuristics override only
mismatch-friendly extensions (e.g. `.txt` / `.md` / unknown). Peak sniff
window: **4 KiB**.

Processor registry maps format → existing pipelines:

| Format                                   | Processor                                 |
| ---------------------------------------- | ----------------------------------------- |
| json / yaml / csv                        | `read.json` / `read.yaml` / `read.csv`    |
| text / markdown / source / xml / unknown | `read.text`                               |
| binary                                   | `reject.binary`                           |
| indexable formats                        | also `index.text` via `isIndexableFormat` |

No libmagic; no PDF/DOCX extractors in this slice.

### Large file processing (ADR-0088)

Sequential windowed reads built on `os.files.readBytes` — peak memory ≈ one
chunk (no Node `ReadableStream` / full-file buffer).

```ts
readFileChunks(path, opts?): IterableIterator<FileChunk>;
forEachFileChunk(path, fn, opts?): { chunks: number; bytesRead: number };
```

`FileChunk`: `{ path, index, byteOffset, byteLength, content, truncated, eof }`.

Options: `chunkSize` (default `min(maxReadBytes, maxChunkBytes)`), `maxBytes`
(optional total budget), `offset` (default 0). `chunkSize > maxChunkBytes`
throws `invalid_input`. Does not parse JSON/YAML/CSV across chunks.

| Limit                  | Default | Role                          |
| ---------------------- | ------- | ----------------------------- |
| `maxReadBytes`         | 256 KiB | Single `readFile` window      |
| `maxChunkBytes`        | 256 KiB | Cap for `readFileChunks` size |
| `maxAtomicAppendBytes` | 16 MiB  | Atomic-append rewrite cap     |

Config/env: see [Configuration.md](./Configuration.md).

### Search engine (ADR-0076)

`findFiles(query)` → `FileSearchResult`:

```ts
{
  pattern: string;          // basename glob: * and ?
  root?: string;
  content?: boolean;        // also scan text ≤ maxReadBytes
  limit?: number;           // default 50
  maxDepth?: number;        // default 8
  includeHidden?: boolean;  // default false
  extensions?: string[];    // e.g. [".ts", "md"]
  filesOnly?: boolean;      // default true
}
```

`FileSearchResult`: `{ hits, truncated, scannedEntries, durationMs }`.

`FileHit`: `{ path, name, match?, isFile, isDirectory, isSymbolicLink?, size?, mtimeMs?, extension? }`.

Search uses `lstat`, does not follow symlink directories, skips hidden names/dirs
unless `includeHidden`, and stops at `limit` (`truncated: true`).

### Navigation (ADR-0075)

- `resolvePath(path)` → absolute path inside roots
- `listDirectory(path?, { includeHidden? })` → `DirEntry[]`
- `walkDirectory(path?, { maxDepth?, followSymlinks?, includeHidden?, limit? })` → `DirEntry[]`

`DirEntry`: `{ path, name, isFile, isDirectory, isSymbolicLink, size?, mtimeMs?, linkTarget? }`.

Relative paths resolve against `roots[0]`. Paths outside roots or matching the
sensitive deny list throw `PlatformError` (`permission_denied`).

**Symlinks:** entries are reported via `lstat`. Walk does **not** follow links
unless `followSymlinks: true` (targets must remain inside roots; cycles skipped).

Defaults: max depth **8**, max read **256 KiB**, hit/walk limit **50**.

### Metadata (ADR-0077)

`getFileMetadata(path, opts?)` → `FileMetadata`:

```ts
{
  path, name, extension, size,
  isFile, isDirectory, isSymbolicLink,
  createdAtMs, modifiedAtMs,
  mode, permissions,              // e.g. "rw-r--r--"
  owner: { uid, gid, name? },
  mimeType,                       // detection or extension map
  format?, detectionSource?, extensionMismatch?,  // ADR-0089
  checksum?: { algorithm: "sha256"; hex },
  checksumSkipped?: string,
}
```

Options: `followSymlinks` (default true → `stat`), `includeChecksum`
(default true for regular files), `maxChecksumBytes` (default 16 MiB),
`includeTypeDetection` (default true for regular files).

MIME uses content-aware detection when enabled; directories → `inode/directory`;
unfollowed symlinks → `inode/symlink`. Checksum uses platform `readBytes`
(binary-safe).

---

## Tools

| Tool               | Capability                    | Maps to           |
| ------------------ | ----------------------------- | ----------------- |
| `file.search`      | `filesystem.read`             | `findFiles`       |
| `file.read`        | `filesystem.read`             | `readFile`        |
| `file.read.chunks` | `filesystem.read`             | `readFileChunks`  |
| `file.detect`      | `filesystem.read`             | `detectFileType`  |
| `file.write`       | `filesystem.write`            | `writeFile`       |
| `file.mkdir`       | `filesystem.write`            | `createDirectory` |
| `file.delete`      | `filesystem.delete`           | `deletePath`      |
| `file.move`        | `filesystem.write` + `delete` | `movePath`        |
| `file.copy`        | `filesystem.write`            | `copyPath`        |
| `file.rename`      | `filesystem.write` + `delete` | `renamePath`      |
| `file.restore`     | `filesystem.write` + `delete` | `restorePath`     |
| `file.rmdir`       | `filesystem.delete`           | `deleteDirectory` |
| `file.exists`      | `filesystem.read`             | `pathExists`      |
| `file.resolve`     | `filesystem.read`             | `resolvePath`     |
| `file.list`        | `filesystem.read`             | `listDirectory`   |
| `file.walk`        | `filesystem.read`             | `walkDirectory`   |
| `file.metadata`    | `filesystem.read`             | `getFileMetadata` |

`file.search` accepts `query`, `root`, `content`, `limit`, `maxDepth`,
`includeHidden`, `extensions`, `filesOnly` and returns hit metadata plus
`truncated` / `scannedEntries` / `durationMs`.

`file.metadata` accepts `path` plus optional `followSymlinks`,
`includeChecksum`, `maxChecksumBytes`, `includeTypeDetection` and returns
MIME / format / detection fields when sniffing ran.

`file.read` accepts `path` plus optional `offset`, `maxBytes`, `parse` and
returns format / encoding / truncation / optional structured `data` plus
`detectionSource` / `extensionMismatch`. Prefer `file.read.chunks` for large
files.

`file.detect` accepts `path` and returns MIME / format / processor /
`indexable` / mismatch flags (ADR-0089).

`file.read.chunks` accepts `path` plus optional `chunkSize`, `maxBytes`,
`offset`, `maxChunks` (default **32**) and returns an array of chunk summaries
plus `chunksReturned` / `truncated` (stops early when `maxChunks` is hit).

`file.write` accepts `path`, `content`, plus optional `mode`, `overwrite`,
`encoding`, `atomic`, `bom`, `createDirs` and returns write result fields.

`file.move` moves files or directories (`kind` in output). `file.rmdir` removes
empty directories only. `file.exists` returns existence and type flags.

`file.delete` soft-deletes to Atlas trash by default (`trash: false` for
hard delete) and returns `mode` / `trashId` / `restorable`. `file.restore`
takes `trashId`. `file.copy` / `file.rename` support overwrite protection.

CLI bootstraps FileAccess after platform services and pre-grants
`filesystem.read` only (plus memory). Write/delete require confirmation
(ADR-0083).

---

## Permission validation (ADR-0082)

Order for each public `FileAccessService` method:

1. **Capability** — `PermissionManager.requestPermission` when `permissions` is
   injected (skipped in memory-FS unit tests without a manager).
2. **Path sandbox** — roots + deny patterns → `FileSystemError`
   `permission_denied`.
3. **IO** — injected `os.files` (broker still checks caps on brokered hosts).

| Methods                                                   | Capability                               |
| --------------------------------------------------------- | ---------------------------------------- |
| find/read/list/walk/resolve/exists/metadata/chunks/detect | `filesystem.read`                        |
| write/mkdir/copy                                          | `filesystem.write`                       |
| delete (file/dir/path)                                    | `filesystem.delete`                      |
| move / rename / restore                                   | `filesystem.write` + `filesystem.delete` |

Security logs: **warn** on capability or path deny; **info** when a mutating
op is allowed. File contents are never logged. The OS Permission Broker remains
defense-in-depth (ADR-0066).

---

## Error handling (ADR-0090)

Product FS throws `FileSystemError` (extends `PlatformError`) with a stable
`kind`:

| Kind                | Platform code        | Atlas code             | Typical cause                                |
| ------------------- | -------------------- | ---------------------- | -------------------------------------------- |
| `permission_denied` | `permission_denied`  | `fs_permission_denied` | Outside roots, deny list, missing capability |
| `file_not_found`    | `resource_not_found` | `fs_file_not_found`    | Missing path                                 |
| `invalid_path`      | `invalid_input`      | `fs_invalid_path`      | Empty/bad path, wrong entry type for op      |
| `unsupported_type`  | `unsupported`        | `fs_unsupported_type`  | Binary / unsupported format                  |
| `disk_full`         | `disk_full`          | `fs_disk_full`         | `ENOSPC` / `EDQUOT`                          |
| `unknown`           | `unknown`            | `fs_unknown`           | Unexpected failure                           |

`toAtlasFileSystemError` builds AtlasErrorResponse-compatible objects. File
tools attach them as `data.atlas` (plus `data.code` / `data.kind`). Core
`fromPlatformError` prefers these `fs_*` codes when `FileSystemError` /
`detail.fsKind` / `disk_full` is present.

---

## Safe file operations (ADR-0083)

**Confirmation:** Destructive ops (delete, restore, overwrite/append write,
overwrite copy/move) block with `approvalId` when the capability is not granted.
Hosts call `resolveApproval(id, "approved", { sessionGrant: false })` for a
**one-shot** allow (consumed on the next matching request). Default
`sessionGrant: true` still exists for non-destructive creates / memory.

CLI wires `configureFsConfirmHost` + TTY `[y/N]` prompt; file tools wrap calls
in `withFsConfirmRetry` (single retry). Non-TTY fails closed.

**Overwrite backup:** Before replacing an existing path, content is moved to
Atlas trash. Results may include `backupId` / `backedUp`; restore with
`restorePath(backupId)`. Targets are validated with `assertAllowed`.

---

## File watcher (ADR-0084)

`FileWatcherService` monitors directories via platform `os.files.watch`
(Node `fs.watch`). Bootstrap with
`bootstrapFileWatcherFromRegistry(registry, { onFileEvent, roots, permissions })`
— does **not** auto-watch; call `watchDirectory(path?, { recursive?, debounceMs?, ignoreGlobs? })`.

Normalized events (optional publisher → EventBus via
`createFileSystemEventPublisher`):

| Event                                         | Meaning                                          |
| --------------------------------------------- | ------------------------------------------------ |
| `FileCreated` / `FileUpdated` / `FileDeleted` | Path change after re-stat                        |
| `FileRenamed`                                 | Best-effort delete+create pair under same parent |
| `FolderChanged`                               | Parent folder affected by create/delete/rename   |

Requires `filesystem.read`. Paths must stay inside configured roots / deny list.

---

## Recent files index (ADR-0085)

SQLite MRU of paths touched by successful **read/write** (not list/search/
watcher). CLI binds `FileAccessService.onAccess` / `onPathGone` to
`database.recentFiles` when DB is enabled; tools call `listRecentFiles` via
the filesystem query façade.

| Surface        | Role                                                     |
| -------------- | -------------------------------------------------------- |
| `recent_files` | `last_accessed_at`, `access_count`, `last_action`        |
| `file.recent`  | Tool: `limit`, `sort` (`recent`\|`frequent`), filters    |
| `atlas recent` | CLI list (requires DB; `--sort`, `--prefix`, `--action`) |

This is **not** Architecture/24 content indexing.

---

## Ignore rules (ADR-0086)

Discovery (`list` / `walk` / `findFiles` / watch) soft-skips paths via a shared
`IgnoreRulesEngine`. Security deny remains a hard gate. Explicit read/write of
an ignored path still works.

| Layer    | Source                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Built-in | `node_modules/`, `dist/`, `build/`, `target/`, `__pycache__/`, `.venv/`, temps (`*.tmp`, `*~`, `.DS_Store`, …) |
| Config   | `filesystem.ignorePatterns` (+ env `ATLAS_FS_IGNORE_PATTERNS`)                                                 |
| Project  | Cascading `.gitignore`; `.atlasignore` at roots                                                                |
| Hidden   | `includeHidden` default false (unchanged)                                                                      |

Per-call override: `respectIgnore: false`. Future content index must reuse this
engine.

---

## File indexing (ADR-0087)

Persistent metadata + SQLite FTS5 content index (`@atlas-ai/search`). Bulk build
via `atlas index build`; incremental updates from watcher/EventBus. Always
respects ignore rules. Semantic/hybrid retrieval remains deferred
(Architecture/24) via `SemanticIndexSink`.

| Surface             | Role                                       |
| ------------------- | ------------------------------------------ |
| `indexed_files`     | path, name, ext, size, mtime, hash, status |
| `indexed_files_fts` | Keyword search over path/name/content      |
| `atlas index *`     | `build` / `status` / `search`              |
| `file.index.search` | Tool façade over the FTS index             |

Distinct from `recent_files` MRU (ADR-0085).

---

## Commands

```bash
pnpm filesystem:build
pnpm exec vitest run packages/filesystem packages/tools/src/builtins/file-tools.test.ts
pnpm packages:build
```

---

## Out of scope (this slice)

- Hybrid retrieval / ranking / context builder (Architecture/24 remainder)
- Embedding generation / sqlite-vss / ANN
- Driving MRU from watcher FileCreated/Updated
- Full gitignore parity (`git check-ignore` identical)
- Migrating all remaining `node:fs` usage in ai/logging/database
- Cross-volume rename fallbacks (`EXDEV`) / OS Trash / Recycle Bin
- Trash TTL / auto-purge
- Tauri native FS plugins / chokidar
- Changing `deleteDirectory` empty-only semantics
- libmagic / full HTML5 mimesniff / PDF-DOCX extractors / Windows ACL owner resolution
- Full YAML 1.2 / XML DOM / Markdown AST / Node ReadableStream / multi-GB without windows
