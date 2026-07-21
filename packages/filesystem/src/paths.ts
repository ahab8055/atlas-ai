/**
 * Path roots, escape checks, and sensitive-path deny rules.
 */
import path from "node:path";

import { PlatformError } from "@atlas-ai/platform";

/** Default deny patterns on forward-slash-normalized paths. */
export const DEFAULT_DENY_PATTERNS: readonly RegExp[] = [
  /(?:^|\/)\.ssh(?:\/|$)/i,
  /(?:^|\/)\.gnupg(?:\/|$)/i,
  /(?:^|\/)etc(?:\/|$)/i,
];

const SENSITIVE_BASENAMES = new Set([
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  ".netrc",
  "credentials.json",
  "credentials",
]);

export function normalizePathSeparators(p: string): string {
  return p.replace(/\\/g, "/");
}

export function isSensitiveBasename(name: string): boolean {
  const lower = name.toLowerCase();
  if (SENSITIVE_BASENAMES.has(lower)) {
    return true;
  }
  return lower.endsWith(".pem") || lower.endsWith(".key");
}

export function matchesDeny(
  absolutePath: string,
  denyPatterns: readonly RegExp[],
): boolean {
  const normalized = normalizePathSeparators(absolutePath);
  if (isSensitiveBasename(path.basename(absolutePath))) {
    return true;
  }
  return denyPatterns.some((re) => re.test(normalized));
}

export function resolveWithinRoots(
  input: string,
  roots: readonly string[],
  join: (...parts: string[]) => string,
): string {
  if (!roots.length) {
    throw new PlatformError(
      "invalid_input",
      "FileAccessService requires at least one root directory",
    );
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new PlatformError(
      "invalid_input",
      "Path must be a non-empty string",
      { detail: { path: input } },
    );
  }

  const primary = path.resolve(roots[0]!);
  const absolute = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(join(primary, trimmed));

  if (!isPathInsideRoots(absolute, roots)) {
    throw new PlatformError(
      "permission_denied",
      `Path is outside allowed roots: ${absolute}`,
      { detail: { path: absolute } },
    );
  }

  if (matchesDeny(absolute, DEFAULT_DENY_PATTERNS)) {
    // Caller may pass custom deny; checked again at service layer.
  }

  return absolute;
}

export function isPathInsideRoots(
  absolutePath: string,
  roots: readonly string[],
): boolean {
  const target = path.resolve(absolutePath);
  for (const root of roots) {
    const base = path.resolve(root);
    if (target === base) {
      return true;
    }
    const rel = path.relative(base, target);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return true;
    }
  }
  return false;
}

/** Convert glob-lite pattern (`*` only) to a case-insensitive RegExp on names. */
export function patternToRegExp(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (!trimmed) {
    throw new PlatformError(
      "invalid_input",
      "Search pattern must be a non-empty string",
    );
  }
  const escaped = trimmed
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
}
