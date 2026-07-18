/**
 * Shared Node EnvService + FsService (identical across OS).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { EnvService, FsService } from "../types.js";

export function createNodeEnvService(
  env: NodeJS.ProcessEnv = process.env,
): EnvService {
  return {
    get(name: string): string | undefined {
      const value = env[name];
      return value === undefined || value === "" ? undefined : value;
    },
    getOr(name: string, fallback: string): string {
      const value = env[name];
      return value === undefined || value === "" ? fallback : value;
    },
  };
}

export function createNodeFsService(): FsService {
  return {
    exists(path: string): boolean {
      return existsSync(path);
    },
    mkdirp(path: string): void {
      mkdirSync(path, { recursive: true });
    },
    readText(path: string): string {
      return readFileSync(path, "utf8");
    },
    writeText(path: string, data: string, mode?: number): void {
      writeFileSync(path, data, {
        encoding: "utf8",
        ...(mode !== undefined ? { mode } : {}),
      });
    },
  };
}
