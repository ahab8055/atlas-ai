import type { PlatformServices } from "../types.js";
import {
  createNodePlatformServices,
  type CreateNodeServicesOptions,
} from "./services.js";

/**
 * Isolated darwin Node adapter — auto-wires Darwin OperatingSystem provider
 * (ADR-0064).
 */
export function createDarwinPlatformServices(
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  return createNodePlatformServices("darwin", {
    ...options,
    useDarwinOs: options.useDarwinOs !== false,
  });
}
