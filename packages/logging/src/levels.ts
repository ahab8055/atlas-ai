import type { AtlasLogLevel } from "./types.js";

const LEVEL_RANK: Record<AtlasLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  critical: 60,
};

export function shouldLog(
  configured: AtlasLogLevel,
  messageLevel: AtlasLogLevel,
): boolean {
  return LEVEL_RANK[messageLevel] >= LEVEL_RANK[configured];
}

export function parseLogLevel(
  value: string | undefined,
  fallback: AtlasLogLevel = "info",
): AtlasLogLevel {
  if (!value) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (normalized in LEVEL_RANK) {
    return normalized as AtlasLogLevel;
  }
  if (normalized === "warning") {
    return "warn";
  }
  if (normalized === "fatal") {
    return "critical";
  }
  return fallback;
}
