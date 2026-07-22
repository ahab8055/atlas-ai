/**
 * In-memory FileSystemService for unit tests (no node:fs I/O).
 * Supports optional symlinks for directory-navigation tests (ADR-0075).
 * File bodies stored as bytes so writeBytes / UTF-16 round-trips work.
 */
import type { FileStat, FileSystemService } from "@atlas-ai/platform";
import { PlatformError } from "@atlas-ai/platform";

type Entry =
  | { kind: "file"; bytes: Uint8Array }
  | { kind: "dir" }
  | { kind: "symlink"; target: string };

const utf8 = new TextEncoder();
const utf8Dec = new TextDecoder("utf-8");

function norm(p: string): string {
  const n = p.replace(/\\/g, "/");
  if (n.length > 1 && n.endsWith("/")) {
    return n.slice(0, -1);
  }
  return n || "/";
}

function baseStat(
  partial: Omit<FileStat, "birthtimeMs" | "mode" | "uid" | "gid"> &
    Partial<Pick<FileStat, "birthtimeMs" | "mode" | "uid" | "gid">>,
): FileStat {
  return {
    ...partial,
    birthtimeMs: partial.birthtimeMs ?? partial.mtimeMs,
    mode: partial.mode ?? 0o100644,
    uid: partial.uid ?? 1000,
    gid: partial.gid ?? 1000,
  };
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export interface MemoryFileSystemService extends FileSystemService {
  /** Create a symlink entry (target may be relative). */
  symlink(linkPath: string, target: string): void;
}

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
      store.set(norm(p), { kind: "file", bytes: utf8.encode(content) });
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
      return utf8Dec.decode(entry.bytes);
    },
    readBytes(
      p: string,
      opts?: { offset?: number; length?: number },
    ): Uint8Array {
      const { entry } = resolveFollow(p);
      if (entry.kind !== "file") {
        throw new PlatformError("io_error", `Is a directory: ${p}`);
      }
      const all = entry.bytes;
      const offset = opts?.offset ?? 0;
      if (!Number.isFinite(offset) || offset < 0) {
        throw new PlatformError("invalid_input", `Invalid offset: ${offset}`);
      }
      if (offset >= all.length) {
        return new Uint8Array(0);
      }
      const maxReadable = all.length - offset;
      const toRead =
        opts?.length === undefined
          ? maxReadable
          : Math.min(opts.length, maxReadable);
      return all.subarray(offset, offset + toRead);
    },
    writeText(p: string, data: string): void {
      store.set(norm(p), { kind: "file", bytes: utf8.encode(data) });
    },
    writeBytes(p: string, data: Uint8Array): void {
      store.set(norm(p), { kind: "file", bytes: new Uint8Array(data) });
    },
    appendBytes(p: string, data: Uint8Array): void {
      const key = norm(p);
      const existing = store.get(key);
      if (!existing) {
        store.set(key, { kind: "file", bytes: new Uint8Array(data) });
        return;
      }
      if (existing.kind !== "file") {
        throw new PlatformError("io_error", `Is a directory: ${p}`);
      }
      store.set(key, {
        kind: "file",
        bytes: concatBytes(existing.bytes, data),
      });
    },
    rename(from: string, to: string): void {
      const fromKey = norm(from);
      const toKey = norm(to);
      const entry = store.get(fromKey);
      if (!entry) {
        throw new PlatformError("resource_not_found", `missing ${from}`, {
          detail: { path: from, errno: "ENOENT" },
        });
      }
      if (entry.kind === "dir") {
        const prefix = `${fromKey}/`;
        const moves: Array<{ oldKey: string; newKey: string; value: Entry }> = [
          { oldKey: fromKey, newKey: toKey, value: entry },
        ];
        for (const [k, v] of store.entries()) {
          if (k.startsWith(prefix)) {
            moves.push({
              oldKey: k,
              newKey: `${toKey}/${k.slice(prefix.length)}`,
              value: v,
            });
          }
        }
        for (const m of moves) {
          store.delete(m.oldKey);
        }
        for (const m of moves) {
          store.set(m.newKey, m.value);
        }
        return;
      }
      store.delete(fromKey);
      store.set(toKey, entry);
    },
    copyFile(from: string, to: string): void {
      const fromKey = norm(from);
      const toKey = norm(to);
      if (store.has(toKey)) {
        throw new PlatformError(
          "invalid_input",
          `Destination already exists: ${to}`,
          { detail: { path: to } },
        );
      }
      const entry = store.get(fromKey);
      if (!entry) {
        throw new PlatformError("resource_not_found", `missing ${from}`, {
          detail: { path: from, errno: "ENOENT" },
        });
      }
      if (entry.kind !== "file") {
        throw new PlatformError(
          "invalid_input",
          `copyFile requires a file: ${from}`,
          { detail: { path: from } },
        );
      }
      store.set(toKey, {
        kind: "file",
        bytes: new Uint8Array(entry.bytes),
      });
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
      return baseStat({
        path: p,
        isFile: entry.kind === "file",
        isDirectory: entry.kind === "dir",
        size: entry.kind === "file" ? entry.bytes.length : 0,
        mtimeMs: 0,
        isSymbolicLink: false,
      });
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
        return baseStat({
          path: p,
          isFile: false,
          isDirectory: false,
          size: 0,
          mtimeMs: 0,
          isSymbolicLink: true,
          mode: 0o120777,
        });
      }
      return baseStat({
        path: p,
        isFile: e.kind === "file",
        isDirectory: e.kind === "dir",
        size: e.kind === "file" ? e.bytes.length : 0,
        mtimeMs: 0,
        isSymbolicLink: false,
      });
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
