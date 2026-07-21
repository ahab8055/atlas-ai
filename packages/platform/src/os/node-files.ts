/**
 * Node FileSystemService — fuller FS API over node:fs (ADR-0062 / 0068 / 0075).
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
  type Stats,
} from "node:fs";

import { translateNativeError } from "./translate-error.js";
import type { FileStat, FileSystemService } from "./types.js";

function toFileStat(path: string, s: Stats, isSymbolicLink: boolean): FileStat {
  return {
    path,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    size: s.size,
    mtimeMs: s.mtimeMs,
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
  };
}
