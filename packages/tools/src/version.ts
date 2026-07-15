export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export function parseSemVer(version: string): SemVer | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Compare a vs b: negative if a < b, 0 if equal, positive if a > b. */
export function compareSemVer(a: string, b: string): number {
  const left = parseSemVer(a);
  const right = parseSemVer(b);
  if (!left || !right) {
    return a.localeCompare(b);
  }
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

export function isValidSemVer(version: string): boolean {
  return parseSemVer(version) !== null;
}
