/**
 * Resolve absolute Atlas data/models/db paths under userDataDir (opt-in).
 * Does not change DEFAULT_APP_CONFIG relative defaults.
 */
import type {
  PlatformServices,
  ResolvedAtlasPaths,
  ResolvePlatformPathsOverrides,
} from "./types.js";
import { DEFAULT_APP_NAME } from "./types.js";

export function resolvePlatformPaths(
  services: PlatformServices,
  overrides: ResolvePlatformPathsOverrides = {},
): ResolvedAtlasPaths {
  const appName = overrides.appName ?? DEFAULT_APP_NAME;
  const root = services.paths.userDataDir(appName);
  const dataDir = overrides.dataDir ?? services.paths.join(root, "data");
  const modelsDir = overrides.modelsDir ?? services.paths.join(root, "models");
  const databasePath =
    overrides.databasePath ?? services.paths.join(dataDir, "atlas.sqlite");
  return { dataDir, modelsDir, databasePath };
}
