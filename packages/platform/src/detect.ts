/**
 * Map Node process.platform to supported PlatformId.
 */
import type { PlatformId } from "./types.js";

export function detectPlatformId(
  nodePlatform: string = process.platform,
): PlatformId {
  switch (nodePlatform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "win32";
    default:
      throw new Error(
        `Unsupported platform: ${nodePlatform}. Atlas supports darwin, linux, and win32.`,
      );
  }
}
