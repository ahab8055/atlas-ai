# Atlas AI — File System Access

Product File System Access layer (Architecture/26 §3) on top of platform
`os.files`. Tools and agents use **`FileAccessService`**; they do not call
`node:fs` for this path.

Related: [Platform-Abstraction.md](./Platform-Abstraction.md),
[Tool-Registry.md](./Tool-Registry.md), [Security.md](./Security.md),
[CLI.md](./CLI.md), [ADR-0074](../adr/0074-file-system-access-service.md),
[`@atlas-ai/filesystem`](../../packages/filesystem/).

---

## Layering

| Layer   | Type                             | Role                                                  |
| ------- | -------------------------------- | ----------------------------------------------------- |
| Product | `FileAccessService`              | Search, read/write, mkdir, delete, move; roots + deny |
| OS      | `FileSystemService` (`os.files`) | Path CRUD + `PlatformError` + broker                  |

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
const hits = files.findFiles({ pattern: "*.txt" });
```

---

## API

- `findFiles({ pattern, root?, content?, limit? })` → `FileHit[]`
- `readFile(path)` → `{ path, content, size }`
- `writeFile(path, content, { createDirs?, overwrite? })`
- `createDirectory(path)`
- `deleteFile(path)`
- `moveFile(from, to)` — files only (MVP)

Relative paths resolve against `roots[0]`. Paths outside roots or matching the
sensitive deny list throw `PlatformError` (`permission_denied`).

Defaults: max depth **8**, max read **256 KiB**, hit limit **50**.

---

## Tools

| Tool          | Capability                    | Maps to           |
| ------------- | ----------------------------- | ----------------- |
| `file.search` | `filesystem.read`             | `findFiles`       |
| `file.read`   | `filesystem.read`             | `readFile`        |
| `file.write`  | `filesystem.write`            | `writeFile`       |
| `file.mkdir`  | `filesystem.write`            | `createDirectory` |
| `file.delete` | `filesystem.delete`           | `deleteFile`      |
| `file.move`   | `filesystem.write` + `delete` | `moveFile`        |

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
- Directory `moveFile` / native rename
- Tauri native FS plugins
