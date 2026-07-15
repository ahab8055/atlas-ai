import type { Logger } from "@atlas-ai/logging";

import type { ContextManager } from "./context/manager.js";
import { getDefaultContextManager } from "./context/manager.js";
import type { ExecutionController } from "./execution/controller.js";
import { getDefaultExecutionController } from "./execution/controller.js";
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
  contextManager?: ContextManager;
  executionController?: ExecutionController;
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
  const contextManager = options.contextManager ?? getDefaultContextManager();
  const executionController =
    options.executionController ?? getDefaultExecutionController();
  const request = normalizeRequest(incoming);

  logStage(logger, "RequestReceived", "normalize", request.traceId, {
    source: request.source,
    sessionId: request.sessionId,
    textLength: request.text.length,
  });

  const intent = detectIntent(request);
  logStage(logger, "IntentDetected", "intent", request.traceId, {
    intent: intent.name,
    category: intent.category,
    goal: intent.goal,
    confidence: intent.confidence,
    complexity: intent.complexity,
    known: intent.known,
    parameters: intent.parameters,
    capabilities: intent.capabilities,
  });

  const context = loadContext(request, intent, { manager: contextManager });
  logStage(logger, "ContextLoaded", "context", request.traceId, {
    sources: context.sources,
    turnCount: context.conversation.turns.length,
    memoryCount: context.memories.length,
    knowledgeCount: context.knowledge.length,
    activeTaskCount: context.activeTasks.length,
    preferredEditor: context.preferences.preferredEditor,
    project: context.project?.name,
    runtime: context.systemState.runtime,
    conversationSummary: context.conversationSummary,
  });

  const plan = createPlan(request, intent, context);
  logStage(logger, "PlanCreated", "planning", request.traceId, {
    planId: plan.id,
    goal: plan.goal,
    kind: plan.kind,
    stepCount: plan.steps.length,
    requiresApproval: plan.requiresApproval,
    steps: plan.steps.map((s) => ({
      order: s.order,
      id: s.id,
      tool: s.tool,
      capability: s.capability,
    })),
  });

  logStage(logger, "ExecutionStarted", "execution", request.traceId, {
    planId: plan.id,
    stepCount: plan.steps.length,
  });

  const execution = executePlan(request, plan, {
    controller: executionController,
    onProgress: (task) => {
      logger.debug("ExecutionProgress", {
        category: "tool",
        traceId: request.traceId,
        context: {
          taskId: task.id,
          state: task.state,
          progress: task.progress,
          failureCount: task.failures.length,
        },
      });
    },
  });

  logStage(logger, "ExecutionCompleted", "execution", request.traceId, {
    taskId: execution.taskId,
    status: execution.status,
    lifecycle: execution.lifecycle,
    progress: execution.progress,
    failures: execution.failures,
    steps: execution.steps.map((s) => ({ id: s.stepId, status: s.status })),
  });

  const response = generateResponse(request, intent, execution, plan);
  logStage(logger, "ResponseGenerated", "response", request.traceId, {
    intent: response.intent,
    status: response.status,
    responseLength: response.text.length,
  });

  contextManager.recordAssistant(request.sessionId, response.text, intent.name);

  return {
    request,
    intent,
    context,
    plan,
    execution,
    response,
  };
}
