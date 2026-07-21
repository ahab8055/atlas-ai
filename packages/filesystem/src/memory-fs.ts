/**
 * In-memory FileSystemService for unit tests (no node:fs I/O).
 */
import type { FileStat, FileSystemService } from "@atlas-ai/platform";
import { PlatformError } from "@atlas-ai/platform";

type Entry = { kind: "file"; content: string } | { kind: "dir" };

function norm(p: string): string {
  const n = p.replace(/\\/g, "/");
  if (n.length > 1 && n.endsWith("/")) {
    return n.slice(0, -1);
  }
  return n || "/";
}

/**
 * @param initial - path → file content, or `null` for an empty directory
 */
export function createMemoryFileSystemService(
  initial: Record<string, string | null> = {},
): FileSystemService {
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
      if (ex?.kind === "file") {
        throw new PlatformError("io_error", `Not a directory: ${nk}`);
      }
      store.set(nk, { kind: "dir" });
    }
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
      const e = store.get(norm(p));
      if (!e) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      if (e.kind !== "file") {
        throw new PlatformError("io_error", `Is a directory: ${p}`);
      }
      return e.content;
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
      const key = norm(p);
      const e = store.get(key);
      if (!e) {
        throw new PlatformError("resource_not_found", `missing ${p}`, {
          detail: { path: p, errno: "ENOENT" },
        });
      }
      return {
        path: p,
        isFile: e.kind === "file",
        isDirectory: e.kind === "dir",
        size: e.kind === "file" ? Buffer.byteLength(e.content, "utf8") : 0,
        mtimeMs: 0,
      };
    },
  };
}
