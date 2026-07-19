/**
 * Map Node process.platform to supported PlatformId.
 */
import { PlatformError } from "./os/errors.js";
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
      throw new PlatformError(
        "unsupported",
        `Unsupported platform: ${nodePlatform}. Atlas supports darwin, linux, and win32.`,
        { detail: { platform: nodePlatform } },
      );
  }
}
