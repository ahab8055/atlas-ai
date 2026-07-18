/**
 * Node FileSystemService — fuller FS API over node:fs (ADR-0062).
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

import { PlatformError } from "./errors.js";
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
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    writeText(path: string, data: string, mode?: number): void {
      try {
        writeFileSync(path, data, {
          encoding: "utf8",
          ...(mode !== undefined ? { mode } : {}),
        });
      } catch (error) {
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    mkdirp(path: string): void {
      try {
        mkdirSync(path, { recursive: true });
      } catch (error) {
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    remove(path: string): void {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch (error) {
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    listDir(path: string): string[] {
      try {
        return readdirSync(path);
      } catch (error) {
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
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
        throw new PlatformError(
          "io_error",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}
