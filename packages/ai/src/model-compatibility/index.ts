export type {
  CategoryCheckResult,
  CompatibilityIssue,
  CompatibilityIssueCategory,
  CompatibilityIssueCode,
  CompatibilityMode,
  ModelCompatibilityInput,
  ModelCompatibilityResult,
} from "./types.js";

export {
  assertModelCompatible,
  checkModelCompatibility,
  formatCompatibilityReport,
} from "./checker.js";
