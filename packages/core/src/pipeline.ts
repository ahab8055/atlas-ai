import type { Logger } from "@atlas-ai/logging";

import { type OrchestrationEvent } from "./events.js";
import { normalizeRequest } from "./normalize.js";
import { loadContext } from "./stages/context.js";
import { executePlan } from "./stages/execute.js";
import { detectIntent } from "./stages/intent.js";
import { createPlan } from "./stages/plan.js";
import { generateResponse } from "./stages/respond.js";
import type {
  IncomingRequest,
  PipelineResult,
  PipelineStageName,
} from "./types.js";

export interface PipelineOptions {
  logger: Logger;
}

function logStage(
  logger: Logger,
  event: OrchestrationEvent,
  stage: PipelineStageName,
  traceId: string,
  context?: Record<string, unknown>,
): void {
  logger.info(event, {
    category: stage === "execution" ? "tool" : "ai",
    traceId,
    context: {
      stage,
      event,
      ...context,
    },
  });
}

/**
 * Run the central request processing pipeline.
 *
 * User Input → Request Handler → Intent → Context → Plan → Execute → Respond
 */
export function runPipeline(
  incoming: IncomingRequest,
  options: PipelineOptions,
): PipelineResult {
  const { logger } = options;
  const request = normalizeRequest(incoming);

  logStage(logger, "RequestReceived", "normalize", request.traceId, {
    source: request.source,
    sessionId: request.sessionId,
    textLength: request.text.length,
  });

  const intent = detectIntent(request);
  logStage(logger, "IntentDetected", "intent", request.traceId, {
    intent: intent.name,
    confidence: intent.confidence,
    complexity: intent.complexity,
  });

  const context = loadContext(request, intent);
  logStage(logger, "ContextLoaded", "context", request.traceId, {
    memoryCount: context.memories.length,
    runtime: context.systemState.runtime,
  });

  const plan = createPlan(request, intent, context);
  logStage(logger, "PlanCreated", "planning", request.traceId, {
    stepCount: plan.steps.length,
    requiresApproval: plan.requiresApproval,
    tools: plan.steps.map((s) => s.tool).filter(Boolean),
  });

  logStage(logger, "ExecutionStarted", "execution", request.traceId, {
    stepCount: plan.steps.length,
  });
  const execution = executePlan(request, plan);
  logStage(logger, "ExecutionCompleted", "execution", request.traceId, {
    status: execution.status,
    steps: execution.steps.map((s) => ({ id: s.stepId, status: s.status })),
  });

  const response = generateResponse(request, intent, execution);
  logStage(logger, "ResponseGenerated", "response", request.traceId, {
    intent: response.intent,
    status: response.status,
    responseLength: response.text.length,
  });

  return {
    request,
    intent,
    context,
    plan,
    execution,
    response,
  };
}
