export type {
  AtlasErrorResponse,
  ClassifyErrorInput,
  ErrorCategory,
  RecoveryAction,
  RecoveryStrategy,
} from "./types.js";
export { ERROR_CATEGORY_LABELS } from "./types.js";

export {
  AtlasError,
  classifyCategory,
  createAtlasError,
  formatErrorCategory,
  fromPlatformError,
  fromUnknown,
  isAtlasErrorResponse,
} from "./classify.js";

export { markRecoveryAttempted, suggestRecovery } from "./recovery.js";

export {
  ErrorHandler,
  getDefaultErrorHandler,
  handleError,
  setDefaultErrorHandler,
  type HandleErrorOptions,
} from "./handler.js";
