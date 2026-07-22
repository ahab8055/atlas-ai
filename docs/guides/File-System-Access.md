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
[`@atlas-ai/filesystem`](../../packages/filesystem/).

---

## Layering

| Layer   | Type                             | Role                                                      |
| ------- | -------------------------------- | --------------------------------------------------------- |
| Product | `FileAccessService`              | Search, CRUD, navigate, metadata, read/write, directories |
| OS      | `FileSystemService` (`os.files`) | Path CRUD + ranged bytes + rename + `PlatformError`       |

```ts
import {
  bootstrapFileAccessFromRegistry,
  createFileAccessService,
  getDefaultFileAccessService,
} from "@atlas-ai/filesystem";
import { getDefaultPlatformServiceRegistry } from "@atlas-ai/platform";

bootstrapFileAccessFromRegistry(getDefaultPlatformServiceRegistry(), {
  roots: [process.cwd()],
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
16 MiB; otherwise `appendBytes`.

### Reading engine (ADR-0078)

`readFile(path, opts?)` → `FileContent`:

```ts
{
  path, content, size,           // size = full file (stat)
  format, mimeType, encoding,    // utf-8 | utf-16le | utf-16be
  byteOffset, byteLength, truncated,
  data?,                         // JSON / YAML / CSV when parse succeeds
  parseError?,
}
```

Options: `offset` (default 0), `maxBytes` (default service maxReadBytes /
256 KiB), `parse` (default true). Large files use a byte window
(`truncated: true`); known binary types and binary-like content are rejected.
JSON / YAML / CSV are parsed safely (no new deps); Markdown / XML / source
return text + format only.

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
  mimeType,                       // extension map
  checksum?: { algorithm: "sha256"; hex },
  checksumSkipped?: string,
}
```

Options: `followSymlinks` (default true → `stat`), `includeChecksum`
(default true for regular files), `maxChecksumBytes` (default 16 MiB).

MIME is extension-based; directories → `inode/directory`; unfollowed symlinks →
`inode/symlink`. Checksum uses platform `readBytes` (binary-safe).

---

## Tools

| Tool            | Capability                    | Maps to           |
| --------------- | ----------------------------- | ----------------- |
| `file.search`   | `filesystem.read`             | `findFiles`       |
| `file.read`     | `filesystem.read`             | `readFile`        |
| `file.write`    | `filesystem.write`            | `writeFile`       |
| `file.mkdir`    | `filesystem.write`            | `createDirectory` |
| `file.delete`   | `filesystem.delete`           | `deletePath`      |
| `file.move`     | `filesystem.write` + `delete` | `movePath`        |
| `file.copy`     | `filesystem.write`            | `copyPath`        |
| `file.rename`   | `filesystem.write` + `delete` | `renamePath`      |
| `file.restore`  | `filesystem.write` + `delete` | `restorePath`     |
| `file.rmdir`    | `filesystem.delete`           | `deleteDirectory` |
| `file.exists`   | `filesystem.read`             | `pathExists`      |
| `file.resolve`  | `filesystem.read`             | `resolvePath`     |
| `file.list`     | `filesystem.read`             | `listDirectory`   |
| `file.walk`     | `filesystem.read`             | `walkDirectory`   |
| `file.metadata` | `filesystem.read`             | `getFileMetadata` |

`file.search` accepts `query`, `root`, `content`, `limit`, `maxDepth`,
`includeHidden`, `extensions`, `filesOnly` and returns hit metadata plus
`truncated` / `scannedEntries` / `durationMs`.

`file.metadata` accepts `path` plus optional `followSymlinks`,
`includeChecksum`, `maxChecksumBytes`.

`file.read` accepts `path` plus optional `offset`, `maxBytes`, `parse` and
returns format / encoding / truncation / optional structured `data`.

`file.write` accepts `path`, `content`, plus optional `mode`, `overwrite`,
`encoding`, `atomic`, `bom`, `createDirs` and returns write result fields.

`file.move` moves files or directories (`kind` in output). `file.rmdir` removes
empty directories only. `file.exists` returns existence and type flags.

`file.delete` soft-deletes to Atlas trash by default (`trash: false` for
hard delete) and returns `mode` / `trashId` / `restorable`. `file.restore`
takes `trashId`. `file.copy` / `file.rename` support overwrite protection.

CLI bootstraps FileAccess after platform services and grants the filesystem
capabilities for local use.

---

## Commands

```bash
pnpm filesystem:build
pnpm exec vitest run packages/filesystem packages/tools/src/builtins/file-tools.test.ts
pnpm packages:build
```

---

## Out of scope (this slice)

- Persistent file index / hybrid search (Architecture/24)
- Migrating all remaining `node:fs` usage in ai/logging/database
- Cross-volume rename fallbacks (`EXDEV`) / OS Trash / Recycle Bin
- Trash TTL / auto-purge
- FS watchers / Tauri native FS plugins
- Changing `deleteDirectory` empty-only semantics
- Content-based MIME sniffing / Windows ACL owner resolution
- Full YAML 1.2 / XML DOM / Markdown AST / streaming multi-GB without a window
