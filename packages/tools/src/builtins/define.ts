import type { RegisteredTool, ToolHandler, ToolMetadata } from "../types.js";
import { registerTool } from "../registry.js";

export function defineTool(
  metadata: ToolMetadata,
  handler: ToolHandler,
): RegisteredTool {
  return { metadata, handler };
}

export function registerBuiltin(tool: RegisteredTool): RegisteredTool {
  return registerTool(tool.metadata, tool.handler, { replace: true });
}
