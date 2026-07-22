/**
 * Node FileSystemService — fuller FS API over node:fs (ADR-0062 / 0068 / 0075 / 0077).
 */
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  watch as fsWatch,
  writeFileSync,
  type Stats,
} from "node:fs";
import path from "node:path";

import { translateNativeError } from "./translate-error.js";
import type {
  FileStat,
  FileSystemService,
  FileWatchEvent,
  FileWatchHandle,
  FileWatchOptions,
  ReadBytesOptions,
} from "./types.js";

function toFileStat(path: string, s: Stats, isSymbolicLink: boolean): FileStat {
  return {
    path,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    size: s.size,
    mtimeMs: s.mtimeMs,
    birthtimeMs: s.birthtimeMs,
    mode: s.mode,
    uid: s.uid,
    gid: s.gid,
    isSymbolicLink,
  };
}

export function createNodeFileSystemService(): FileSystemService {
  return {
    exists(path: string): boolean {
      return existsSync(path);
    },
    readText(path: string): string {
      try {
        return readFileSync(path, "utf8");
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.readText",
          path,
        });
      }
    },
    readBytes(path: string, opts?: ReadBytesOptions): Uint8Array {
      try {
        const offset = opts?.offset ?? 0;
        const length = opts?.length;
        if (opts === undefined || (offset === 0 && length === undefined)) {
          return new Uint8Array(readFileSync(path));
        }
        if (!Number.isFinite(offset) || offset < 0) {
          throw Object.assign(new Error("Invalid offset"), { code: "EINVAL" });
        }
        if (length !== undefined && (!Number.isFinite(length) || length < 0)) {
          throw Object.assign(new Error("Invalid length"), { code: "EINVAL" });
        }
        const st = statSync(path);
        if (offset >= st.size) {
          return new Uint8Array(0);
        }
        const maxReadable = st.size - offset;
        const toRead =
          length === undefined ? maxReadable : Math.min(length, maxReadable);
        if (toRead === 0) {
          return new Uint8Array(0);
        }
        const fd = openSync(path, "r");
        try {
          const buf = Buffer.allocUnsafe(toRead);
          const n = readSync(fd, buf, 0, toRead, offset);
          return n === toRead
            ? new Uint8Array(buf)
            : new Uint8Array(buf.subarray(0, n));
        } finally {
          closeSync(fd);
        }
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.readBytes",
          path,
        });
      }
    },
    writeText(path: string, data: string, mode?: number): void {
      try {
        writeFileSync(path, data, {
          encoding: "utf8",
          ...(mode !== undefined ? { mode } : {}),
        });
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.writeText",
          path,
        });
      }
    },
    writeBytes(path: string, data: Uint8Array, opts?: { mode?: number }): void {
      try {
        writeFileSync(path, data, {
          ...(opts?.mode !== undefined ? { mode: opts.mode } : {}),
        });
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.writeBytes",
          path,
        });
      }
    },
    appendBytes(path: string, data: Uint8Array): void {
      try {
        appendFileSync(path, data);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.appendBytes",
          path,
        });
      }
    },
    rename(from: string, to: string): void {
      try {
        renameSync(from, to);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.rename",
          path: from,
        });
      }
    },
    copyFile(from: string, to: string): void {
      try {
        copyFileSync(from, to);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.copyFile",
          path: from,
        });
      }
    },
    mkdirp(path: string): void {
      try {
        mkdirSync(path, { recursive: true });
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.mkdirp",
          path,
        });
      }
    },
    remove(path: string): void {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.remove",
          path,
        });
      }
    },
    listDir(path: string): string[] {
      try {
        return readdirSync(path);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.listDir",
          path,
        });
      }
    },
    stat(path: string): FileStat {
      try {
        const s = statSync(path);
        return toFileStat(path, s, false);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.stat",
          path,
        });
      }
    },
    lstat(path: string): FileStat {
      try {
        const s = lstatSync(path);
        return toFileStat(path, s, s.isSymbolicLink());
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.lstat",
          path,
        });
      }
    },
    readlink(path: string): string {
      try {
        return readlinkSync(path);
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.readlink",
          path,
        });
      }
    },
    watch(
      watchPath: string,
      listener: (event: FileWatchEvent) => void,
      options?: FileWatchOptions,
    ): FileWatchHandle {
      try {
        const recursive = options?.recursive !== false;
        const watcher = fsWatch(
          watchPath,
          { recursive },
          (eventType, filename) => {
            const type =
              eventType === "change" || eventType === "rename"
                ? eventType
                : "rename";
            const full =
              filename != null && filename !== ""
                ? path.resolve(watchPath, filename.toString())
                : path.resolve(watchPath);
            listener({ type, path: full });
          },
        );
        watcher.on("error", () => {
          // Avoid uncaught EMFILE / watcher errors after close or under load.
        });
        return {
          close() {
            watcher.close();
          },
        };
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.watch",
          path: watchPath,
        });
      }
    },
  };
}
