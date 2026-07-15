export type {
  ExecuteOptions,
  ExecutionFailure,
  ExecutionLifecycleState,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  ExecutionTask,
  StepResult,
  StepStatus,
} from "./types.js";

export { executeToolStep } from "./tools.js";

export {
  ExecutionController,
  getDefaultExecutionController,
  setDefaultExecutionController,
} from "./controller.js";

import type { ExecutionPlan } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";
import {
  getDefaultExecutionController,
  type ExecutionController,
} from "./controller.js";
import type { ExecuteOptions, ExecutionResult } from "./types.js";

export interface ExecutePlanOptions extends ExecuteOptions {
  controller?: ExecutionController;
}

/** Convenience: run a plan through the central execution controller. */
export function executePlan(
  request: NormalizedRequest,
  plan: ExecutionPlan,
  options: ExecutePlanOptions = {},
): ExecutionResult {
  const controller = options.controller ?? getDefaultExecutionController();
  const { controller: _c, ...rest } = options;
  return controller.execute(request, plan, rest);
}
