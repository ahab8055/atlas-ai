import type { PlatformServices } from "../types.js";
import {
  createNodePlatformServices,
  type CreateNodeServicesOptions,
} from "./services.js";

/**
 * Isolated linux Node adapter — auto-wires Linux OperatingSystem provider
 * (ADR-0065).
 */
export function createLinuxPlatformServices(
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  return createNodePlatformServices("linux", {
    ...options,
    useLinuxOs: options.useLinuxOs !== false,
  });
}
