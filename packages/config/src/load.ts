import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { applyEnvFile } from "./env-file.js";
import {
  applyEnvOverrides,
  mergeAppConfig,
  parseEnvironment,
  readSecrets,
  DEFAULT_APP_CONFIG,
} from "./merge.js";
import type {
  AtlasAppConfig,
  AtlasConfig,
  AtlasEnvironment,
  LoadConfigOptions,
} from "./types.js";

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function loadEnvironmentFile(
  repoRoot: string,
  env: AtlasEnvironment,
): AtlasAppConfig {
  const base = mergeAppConfig(DEFAULT_APP_CONFIG, { env });
  const filePath = resolve(repoRoot, "config", `${env}.json`);

  if (!existsSync(filePath)) {
    return base;
  }

  return mergeAppConfig(base, readJsonFile(filePath));
}

function loadLocalOverlay(
  repoRoot: string,
  env: AtlasEnvironment,
  current: AtlasAppConfig,
): AtlasAppConfig {
  const localPath = resolve(repoRoot, "config", `${env}.local.json`);
  if (!existsSync(localPath)) {
    return current;
  }
  return mergeAppConfig(current, readJsonFile(localPath));
}

function resolveRepoRoot(explicit?: string): string {
  if (explicit) {
    return isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
  }
  return process.cwd();
}

/**
 * Load Atlas configuration.
 *
 * Precedence (later wins):
 * 1. Package defaults
 * 2. `config/{env}.json` (committed, non-secret)
 * 3. `config/{env}.local.json` (optional, gitignored)
 * 4. `.env` file values (only for keys not already in the process env)
 * 5. Process environment variables (`ATLAS_*`, secret keys)
 *
 * Secrets never come from JSON files.
 */
export function loadConfig(options: LoadConfigOptions = {}): AtlasConfig {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const envVars: NodeJS.ProcessEnv = { ...(options.envVars ?? process.env) };

  if (options.loadEnvFile !== false) {
    applyEnvFile(repoRoot, envVars);
  }

  const env =
    options.env ??
    parseEnvironment(envVars.ATLAS_ENV ?? DEFAULT_APP_CONFIG.env);

  let app = loadEnvironmentFile(repoRoot, env);
  app = loadLocalOverlay(repoRoot, env, app);
  app = applyEnvOverrides(app, envVars);

  if (options.env) {
    app = { ...app, env: options.env };
  }

  return {
    ...app,
    secrets: readSecrets(envVars),
  };
}

export function getConfigDir(repoRoot?: string): string {
  return resolve(resolveRepoRoot(repoRoot), "config");
}
