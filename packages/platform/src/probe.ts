/**
 * Injectable OS probe for PlatformDetector (ADR-0061).
 */
import os from "node:os";

export interface OsProbe {
  /** Node process.platform string (darwin | linux | win32 | …). */
  platform(): string;
  arch(): string;
  /** Kernel / OS release (os.release). */
  release(): string;
  /** OS type name (os.type). */
  type(): string;
  /**
   * Human-readable OS version (os.version).
   * May return undefined when unavailable.
   */
  version(): string | undefined;
  /** Runtime version (e.g. process.versions.node). */
  nodeVersion(): string;
}

export function createNodeOsProbe(): OsProbe {
  return {
    platform: () => process.platform,
    arch: () => os.arch(),
    release: () => os.release(),
    type: () => os.type(),
    version: () => {
      try {
        return os.version();
      } catch {
        return undefined;
      }
    },
    nodeVersion: () => process.versions.node,
  };
}
