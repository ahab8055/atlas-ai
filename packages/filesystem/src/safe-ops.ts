/**
 * Classify FileAccessService authorize() reason strings for confirmation hosts.
 */

const DESTRUCTIVE_REASONS = new Set([
  "deletePath",
  "deleteFile",
  "deleteDirectory",
  "restorePath",
  "writeFile.overwrite",
  "writeFile.append",
  "copyPath.overwrite",
  "movePath.overwrite",
]);

/** True when approving should use sessionGrant: false (one-shot). */
export function isDestructiveFsOperation(reason: string): boolean {
  return DESTRUCTIVE_REASONS.has(reason);
}
