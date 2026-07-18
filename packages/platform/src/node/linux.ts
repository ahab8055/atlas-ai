import type { PlatformServices } from "../types.js";
import {
  createNodePlatformServices,
  type CreateNodeServicesOptions,
} from "./services.js";

/** Isolated linux Node adapter. */
export function createLinuxPlatformServices(
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  return createNodePlatformServices("linux", options);
}
