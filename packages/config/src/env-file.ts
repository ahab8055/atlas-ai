import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal KEY=VALUE parser for `.env` files.
 * Does not execute shell expansion; keeps secrets out of committed code.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load `.env` into process.env without overwriting variables already set
 * (so real environment / CI wins over the file).
 */
export function applyEnvFile(
  repoRoot: string,
  envVars: NodeJS.ProcessEnv,
): void {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const parsed = parseEnvFile(readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (envVars[key] === undefined) {
      envVars[key] = value;
    }
  }
}
