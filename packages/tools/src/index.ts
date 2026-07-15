import { registerBuiltinTools } from "./builtins/index.js";
import { getDefaultToolRegistry } from "./registry.js";

export type {
  RegisteredTool,
  ToolContext,
  ToolDiscoveryQuery,
  ToolHandler,
  ToolJsonSchema,
  ToolMetadata,
  ToolResult,
} from "./types.js";

export type {
  ToolExecutionErrorCode,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolExecutionStatus,
} from "./execution-types.js";

export {
  ToolRegistry,
  getDefaultToolRegistry,
  registerTool,
  setDefaultToolRegistry,
  type RegisterToolOptions,
} from "./registry.js";

export {
  ToolExecutor,
  executeTool,
  getDefaultToolExecutor,
  setDefaultToolExecutor,
} from "./executor.js";

export {
  validateAgainstSchema,
  type SchemaValidationResult,
} from "./schema.js";

export {
  compareSemVer,
  isValidSemVer,
  parseSemVer,
  type SemVer,
} from "./version.js";

export {
  BUILTIN_TOOLS,
  defineTool,
  registerBuiltin,
  registerBuiltinTools,
} from "./builtins/index.js";

/** Ensure MVP builtins are available when the package is imported. */
registerBuiltinTools();

/** Convenience: list latest tools on the default registry. */
export function listTools() {
  return getDefaultToolRegistry().list();
}

export function listToolMetadata() {
  return getDefaultToolRegistry().listMetadata();
}
