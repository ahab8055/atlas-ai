/**
 * Node FileSystemService — fuller FS API over node:fs (ADR-0062 / 0068).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";

import { translateNativeError } from "./translate-error.js";
import type { FileStat, FileSystemService } from "./types.js";

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
        return {
          path,
          isFile: s.isFile(),
          isDirectory: s.isDirectory(),
          size: s.size,
          mtimeMs: s.mtimeMs,
        };
      } catch (error) {
        throw translateNativeError(error, {
          operation: "files.stat",
          path,
        });
      }
    },
  };
}
