/**
 * In-memory FileSystemService for unit tests (no node:fs I/O).
 * Supports optional symlinks for directory-navigation tests (ADR-0075).
 */
import type { FileStat, FileSystemService } from "@atlas-ai/platform";
import { PlatformError } from "@atlas-ai/platform";

type Entry =
  | { kind: "file"; content: string }
  | { kind: "dir" }
  | { kind: "symlink"; target: string };

function norm(p: string): string {
  const n = p.replace(/\\/g, "/");
  if (n.length > 1 && n.endsWith("/")) {
    return n.slice(0, -1);
  }
  return n || "/";
}

export interface MemoryFileSystemService extends FileSystemService {
  /** Create a symlink entry (target may be relative). */
  symlink(linkPath: string, target: string): void;
}

/**
 * @param initial - path → file content, or `null` for an empty directory
 */
export function createMemoryFileSystemService(
  initial: Record<string, string | null> = {},
): MemoryFileSystemService {
  const store = new Map<string, Entry>();

  const mkdirpInternal = (dirPath: string): void => {
    const key = norm(dirPath);
    if (key === "/" || key === ".") {
      store.set(key, { kind: "dir" });
      return;
    }
    const abs = key.startsWith("/");
    const segs = key.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      const dirKey = abs
        ? `/${segs.slice(0, i + 1).join("/")}`
        : segs.slice(0, i + 1).join("/");
      const nk = norm(dirKey);
      const ex = store.get(nk);
      if (ex?.kind === "file" || ex?.kind === "symlink") {
        throw new PlatformError("io_error", `Not a directory: ${nk}`);
      }
      store.set(nk, { kind: "dir" });
    }
  };

  const resolveFollow = (
    p: string,
    seen = new Set<string>(),
  ): { key: string; entry: Entry } => {
    const key = norm(p);
    if (seen.has(key)) {
      throw new PlatformError("io_error", `Symlink cycle at ${p}`, {
        detail: { path: p },
      });
    }
    seen.add(key);
    const e = store.get(key);
    if (!e) {
      throw new PlatformError("resource_not_found", `missing ${p}`, {
        detail: { path: p, errno: "ENOENT" },
      });
    }
    if (e.kind === "symlink") {
      const next = e.target.startsWith("/")
        ? e.target
        : norm(`${key.replace(/\/[^/]+$/, "")}/${e.target}`);
      return resolveFollow(next, seen);
    }
    return { key, entry: e };
  };

  for (const [p, content] of Object.entries(initial)) {
    if (content === null) {
      mkdirpInternal(p);
    } else {
      const parent = p.replace(/[/\\][^/\\]+$/, "");
      if (parent && parent !== p) {
        mkdirpInternal(parent);
      } else {
        store.set(".", { kind: "dir" });
      }
      store.set(norm(p), { kind: "file", content });
    }
  }

  return {
    exists(p: string): boolean {
      return store.has(norm(p));
    },
    readText(p: string): string {
      const { entry } = resolveFollow(p);
      if (entry.kind !== "file") {
        throw new PlatformError("io_error", `Is a directory: ${p}`);
      }
      return entry.content;
    },
    writeText(p: string, data: string): void {
      store.set(norm(p), { kind: "file", content: data });
    },
    mkdirp(p: string): void {
      mkdirpInternal(p);
    },
    remove(p: string): void {
      const key = norm(p);
      if (!store.has(key)) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      for (const k of [...store.keys()]) {
        if (k === key || k.startsWith(`${key}/`)) {
          store.delete(k);
        }
      }
    },
    listDir(p: string): string[] {
      const key = norm(p);
      const prefix = key === "/" ? "/" : `${key}/`;
      const names = new Set<string>();
      let found = store.get(key)?.kind === "dir";
      for (const k of store.keys()) {
        if (!k.startsWith(prefix)) {
          continue;
        }
        found = true;
        const rest = k.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) {
          names.add(name);
        }
      }
      if (!found) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      return [...names].sort();
    },
    stat(p: string): FileStat {
      const { entry } = resolveFollow(p);
      return {
        path: p,
        isFile: entry.kind === "file",
        isDirectory: entry.kind === "dir",
        size:
          entry.kind === "file" ? Buffer.byteLength(entry.content, "utf8") : 0,
        mtimeMs: 0,
        isSymbolicLink: false,
      };
    },
    lstat(p: string): FileStat {
      const key = norm(p);
      const e = store.get(key);
      if (!e) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      if (e.kind === "symlink") {
        return {
          path: p,
          isFile: false,
          isDirectory: false,
          size: 0,
          mtimeMs: 0,
          isSymbolicLink: true,
        };
      }
      return {
        path: p,
        isFile: e.kind === "file",
        isDirectory: e.kind === "dir",
        size: e.kind === "file" ? Buffer.byteLength(e.content, "utf8") : 0,
        mtimeMs: 0,
        isSymbolicLink: false,
      };
    },
    readlink(p: string): string {
      const e = store.get(norm(p));
      if (!e) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      if (e.kind !== "symlink") {
        throw new PlatformError("invalid_input", `Not a symlink: ${p}`, {
          detail: { path: p },
        });
      }
      return e.target;
    },
    symlink(linkPath: string, target: string): void {
      const parent = linkPath.replace(/[/\\][^/\\]+$/, "");
      if (parent && parent !== linkPath) {
        mkdirpInternal(parent);
      }
      store.set(norm(linkPath), { kind: "symlink", target });
    },
  };
}
