/**
 * OS-specific PathService factories for Node.
 */
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import type { EnvService, PathService, PlatformId } from "../types.js";
import { DEFAULT_APP_NAME } from "../types.js";

export interface PathServiceOptions {
  env: EnvService;
  /** Override home for tests. */
  homeDir?: string;
  /** Override temp for tests. */
  tempDir?: string;
  /** Override cwd for tests. */
  cwd?: string;
}

function normalizeAppName(appName: string | undefined, id: PlatformId): string {
  const raw = (appName ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
  if (id === "linux") {
    return raw.toLowerCase();
  }
  return raw;
}

export function createPathService(
  id: PlatformId,
  options: PathServiceOptions,
): PathService {
  const home = () => options.homeDir ?? homedir();
  const temp = () => options.tempDir ?? tmpdir();
  const cwd = () => options.cwd ?? process.cwd();

  return {
    homeDir: home,
    tempDir: temp,
    cwd,
    join: (...parts: string[]) => join(...parts),
    userDataDir(appName?: string): string {
      const name = normalizeAppName(appName, id);
      if (id === "darwin") {
        return join(home(), "Library", "Application Support", name);
      }
      if (id === "win32") {
        const appData =
          options.env.get("APPDATA") ?? join(home(), "AppData", "Roaming");
        return join(appData, name);
      }
      // linux
      const xdg =
        options.env.get("XDG_DATA_HOME") ?? join(home(), ".local", "share");
      return join(xdg, name);
    },
    cacheDir(appName?: string): string {
      const name = normalizeAppName(appName, id);
      if (id === "darwin") {
        return join(home(), "Library", "Caches", name);
      }
      if (id === "win32") {
        const local =
          options.env.get("LOCALAPPDATA") ?? join(home(), "AppData", "Local");
        return join(local, name, "Cache");
      }
      // linux
      const xdg = options.env.get("XDG_CACHE_HOME") ?? join(home(), ".cache");
      return join(xdg, name);
    },
  };
}
