/**
 * Structured platform diagnostics helpers (ADR-0071).
 * Optional Logger — no-op when absent (tests stay quiet).
 */
import type { Logger, LogMethodOptions } from "@atlas-ai/logging";

export type PlatformLogger = Logger;

/** Application-category platform log (init / lifecycle / provider failures). */
export function platformLog(
  logger: Logger | undefined,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!logger) {
    return;
  }
  const options: LogMethodOptions = {
    category: "application",
    ...(context !== undefined ? { context } : {}),
  };
  logger[level](message, options);
}

/** Security-category permission diagnostics. */
export function platformSecurityLog(
  logger: Logger | undefined,
  level: "debug" | "info" | "warn",
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!logger) {
    return;
  }
  const options: LogMethodOptions = {
    category: "security",
    ...(context !== undefined ? { context } : {}),
  };
  logger[level](message, options);
}

/** Provider failure with error object + troubleshooting context. */
export function platformLogError(
  logger: Logger | undefined,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logger?.logError(message, error, {
    category: "application",
    ...(context !== undefined ? { context } : {}),
  });
}
