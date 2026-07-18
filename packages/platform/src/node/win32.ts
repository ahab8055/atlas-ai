import type { PlatformServices } from "../types.js";
import {
  createNodePlatformServices,
  type CreateNodeServicesOptions,
} from "./services.js";

/** Isolated win32 Node adapter. */
export function createWin32PlatformServices(
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  return createNodePlatformServices("win32", options);
}
