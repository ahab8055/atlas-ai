/**
 * PlatformDetector — standardized host OS / arch / kernel / runtime detection.
 */
import { detectPlatformId } from "./detect.js";
import { createNodeOsProbe, type OsProbe } from "./probe.js";
import { platformIdToOs, type PlatformId, type PlatformInfo } from "./types.js";

export interface PlatformDetectorOptions {
  probe?: OsProbe;
}

export class PlatformDetector {
  private readonly probe: OsProbe;

  constructor(options: PlatformDetectorOptions = {}) {
    this.probe = options.probe ?? createNodeOsProbe();
  }

  detectId(): PlatformId {
    return detectPlatformId(this.probe.platform());
  }

  detect(): PlatformInfo {
    const id = this.detectId();
    const osVersion = this.probe.version();
    return {
      id,
      os: platformIdToOs(id),
      arch: this.probe.arch(),
      kernelVersion: this.probe.release(),
      osType: this.probe.type(),
      ...(osVersion !== undefined && osVersion !== "" ? { osVersion } : {}),
      runtime: {
        kind: "node",
        version: this.probe.nodeVersion(),
      },
    };
  }
}

export function createPlatformDetector(
  options?: PlatformDetectorOptions,
): PlatformDetector {
  return new PlatformDetector(options);
}
