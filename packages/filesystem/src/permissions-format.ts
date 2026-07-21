/**
 * Format POSIX mode bits as an rwxrwxrwx string (ADR-0077).
 */
export function modeToPermissions(mode: number): string {
  const perms = mode & 0o777;
  const chars = ["r", "w", "x"] as const;
  let out = "";
  for (let shift = 6; shift >= 0; shift -= 3) {
    const trio = (perms >> shift) & 0o7;
    for (let bit = 2; bit >= 0; bit--) {
      out += trio & (1 << bit) ? chars[2 - bit]! : "-";
    }
  }
  return out;
}
