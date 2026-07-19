import type { Logger } from "@atlas-ai/logging";
import {
  getDefaultPlatformServiceRegistry,
  isPlatformError,
  type PlatformServiceRegistry,
} from "@atlas-ai/platform";

import type { ContextManager } from "./context/manager.js";
import { getDefaultContextManager } from "./context/manager.js";
import type { ContextBuilderOptions } from "./context/builder.js";
import type { LoadedContext } from "./context/types.js";
import {
  ErrorHandler,
  formatErrorCategory,
  getDefaultErrorHandler,
} from "./errors/index.js";
import type { AtlasErrorResponse } from "./errors/types.js";
import type { ExecutionController } from "./execution/controller.js";
import { getDefaultExecutionController } from "./execution/controller.js";
import type { ExecutionResult } from "./execution/types.js";
import {
  getDefaultEventBus,
  publishCoreEvent,
  type CoreEventPayloadMap,
  type CoreEventType,
  type EventBus,
} from "./events/index.js";
import { unknownIntent } from "./intent/index.js";
import type { DetectedIntent } from "./intent/types.js";
import { normalizeRequest } from "./normalize.js";
import { finalizePlan } from "./planning/builders.js";
import type { ExecutionPlan } from "./planning/types.js";
import type { PipelineResponse } from "./response/types.js";
import { modalityForSource } from "./response/status.js";
import { loadContext } from "./stages/context.js";
import { executePlan } from "./stages/execute.js";
import { detectIntent } from "./stages/intent.js";
import { createPlan } from "./stages/plan.js";
import { generateResponse } from "./stages/respond.js";
import type {
  IncomingRequest,
  NormalizedRequest,
  PipelineResult,
  PipelineStageName,
} from "./types.js";

export interface PipelineOptions {
  logger: Logger;
  contextManager?: ContextManager;
  executionController?: ExecutionController;
  /** Internal event bus for component communication (Architecture/10). */
  eventBus?: EventBus;
  /** Optional override; defaults to shared ErrorHandler. */
  errorHandler?: ErrorHandler;
  /** Context Builder options (ADR-0053). */
  contextBuilder?: ContextBuilderOptions;
  /** Platform service registry for OS identity (ADR-0067). */
  platformRegistry?: PlatformServiceRegistry;
}

function stageCategory(stage: PipelineStageName): "tool" | "ai" {
  return stage === "execution" ? "tool" : "ai";
}

/**
 * Publish a core event on the bus and mirror it to structured logs.
 */
function emitCoreEvent<T extends CoreEventType>(
  bus: EventBus,
  logger: Logger,
  type: T,
  stage: PipelineStageName,
  traceId: string,
  payload: CoreEventPayloadMap[T],
): void {
  publishCoreEvent(bus, type, payload, { traceId });

  logger.info(type, {
    category: stageCategory(stage),
    traceId,
    context: {
      event: type,
      ...payload,
    },
  });
}

function emptyContext(
  request: NormalizedRequest,
  platformRegistry?: PlatformServiceRegistry,
): LoadedContext {
  const assembledAt = new Date().toISOString();
  const platformInfo = (
    platformRegistry ?? getDefaultPlatformServiceRegistry()
  ).getInfo();
  return {
    assembledAt,
    sources: [],
    conversation: {
      sessionId: request.sessionId,
      turns: [],
      summary: "",
    },
    preferences: {},
    activeTasks: [],
    systemState: {
      runtime: "degraded",
      source: request.source,
      platform: platformInfo.id,
      arch: platformInfo.arch,
      nodeVersion: platformInfo.runtime.version || "unknown",
      kernelVersion: platformInfo.kernelVersion,
      collectedAt: assembledAt,
    },
    memories: [],
    knowledge: [],
    conversationSummary: "",
  };
}

function failedExecutionFromError(error: AtlasErrorResponse): ExecutionResult {
  const at = error.timestamp;
  return {
    taskId: error.id,
    status: "failed",
    lifecycle: "failed",
    progress: {
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 1,
      blockedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percent: 100,
    },
    steps: [],
    failures: [
      {
        message: error.message,
        code: "unknown",
        at,
      },
    ],
    startedAt: at,
    finishedAt: at,
  };
}

function responseFromStructuredError(
  request: NormalizedRequest,
  intent: DetectedIntent,
  execution: ExecutionResult,
  error: AtlasErrorResponse,
): PipelineResponse {
  const nextSteps = error.recovery.map((action) => action.description);
  const errors = [
    `[${formatErrorCategory(error.category)}] ${error.userMessage}`,
  ];
  const summary = "Request failed";
  const text = [
    summary,
    `Task status: Failed`,
    "",
    "Errors:",
    ...errors.map((line) => `- ${line}`),
    "",
    "Next steps:",
    ...nextSteps.map((step) => `- ${step}`),
  ].join("\n");

  return {
    text,
    spokenText: `The request failed. ${error.userMessage}`,
    summary,
    intent: intent.name,
    status: execution.status,
    lifecycle: execution.lifecycle,
    errors,
    structuredErrors: [error],
    warnings: [],
    nextSteps,
    modality: modalityForSource(request.source),
  };
}

/**
 * Build a degraded but consistent result when an unexpected throw escapes a stage.
 */
function degradedPipelineResult(
  request: NormalizedRequest,
  error: AtlasErrorResponse,
  partial?: {
    intent?: DetectedIntent;
    context?: LoadedContext;
    plan?: ExecutionPlan;
  },
  platformRegistry?: PlatformServiceRegistry,
): PipelineResult {
  const intent = partial?.intent ?? unknownIntent(request.text);
  const context = partial?.context ?? emptyContext(request, platformRegistry);
  const plan =
    partial?.plan ??
    finalizePlan({
      goal: "Recover from unexpected error",
      intentName: intent.name,
      steps: [],
    });
  const execution = failedExecutionFromError(error);
  const response = responseFromStructuredError(
    request,
    intent,
    execution,
    error,
  );
  return { request, intent, context, plan, execution, response };
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
  const eventBus = options.eventBus ?? getDefaultEventBus();
  const errorHandler = options.errorHandler ?? getDefaultErrorHandler();
  const platformRegistry =
    options.platformRegistry ?? getDefaultPlatformServiceRegistry();
  const request = normalizeRequest(incoming);

  let intent: DetectedIntent | undefined;
  let context: LoadedContext | undefined;
  let plan: ExecutionPlan | undefined;

  try {
    emitCoreEvent(
      eventBus,
      logger,
      "RequestReceived",
      "normalize",
      request.traceId,
      {
        stage: "normalize",
        inputSource: request.source,
        sessionId: request.sessionId,
        textLength: request.text.length,
      },
    );

    intent = detectIntent(request);
    emitCoreEvent(
      eventBus,
      logger,
      "IntentDetected",
      "intent",
      request.traceId,
      {
        stage: "intent",
        intent: intent.name,
        category: intent.category,
        goal: intent.goal,
        confidence: intent.confidence,
        complexity: intent.complexity,
        known: intent.known,
        parameters: intent.parameters,
        capabilities: intent.capabilities,
      },
    );

    context = loadContext(request, intent, {
      manager: contextManager,
      builder: options.contextBuilder,
    });
    emitCoreEvent(
      eventBus,
      logger,
      "ContextLoaded",
      "context",
      request.traceId,
      {
        stage: "context",
        sources: context.sources,
        turnCount: context.conversation.turns.length,
        memoryCount: context.memories.length,
        knowledgeCount: context.knowledge.length,
        activeTaskCount: context.activeTasks.length,
        preferredEditor: context.preferences.preferredEditor,
        project: context.project?.name,
        runtime: context.systemState.runtime,
        conversationSummary: context.conversationSummary,
        packageSections: context.contextPackage?.stats.sectionCount,
        packageChars: context.contextPackage?.stats.usedChars,
      },
    );

    plan = createPlan(request, intent, context, {
      builder: options.contextBuilder,
    });
    emitCoreEvent(
      eventBus,
      logger,
      "PlanCreated",
      "planning",
      request.traceId,
      {
        stage: "planning",
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
      },
    );

    emitCoreEvent(
      eventBus,
      logger,
      "ExecutionStarted",
      "execution",
      request.traceId,
      {
        stage: "execution",
        planId: plan.id,
        stepCount: plan.steps.length,
      },
    );

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

    for (const failure of execution.failures) {
      errorHandler.fromExecutionFailure(failure, {
        logger,
        traceId: request.traceId,
        log: true,
      });
    }

    emitCoreEvent(
      eventBus,
      logger,
      "ExecutionCompleted",
      "execution",
      request.traceId,
      {
        stage: "execution",
        taskId: execution.taskId,
        status: execution.status,
        lifecycle: execution.lifecycle,
        progress: { ...execution.progress },
        failures: [...execution.failures],
        steps: execution.steps.map((s) => ({ id: s.stepId, status: s.status })),
      },
    );

    const response = generateResponse(
      request,
      intent,
      execution,
      plan,
      options.contextBuilder ? { builder: options.contextBuilder } : undefined,
      context,
    );
    for (const structured of response.structuredErrors) {
      // Unknown-intent and other response-layer errors — log if not already from execution.
      if (
        !execution.failures.some(
          (failure) =>
            failure.code === structured.code ||
            failure.message === structured.message,
        )
      ) {
        errorHandler.log(structured, logger);
      }
    }

    emitCoreEvent(
      eventBus,
      logger,
      "ResponseGenerated",
      "response",
      request.traceId,
      {
        stage: "response",
        intent: response.intent,
        status: response.status,
        summary: response.summary,
        modality: response.modality,
        errorCount: response.errors.length,
        warningCount: response.warnings.length,
        responseLength: response.text.length,
        spokenLength: response.spokenText.length,
      },
    );

    contextManager.recordAssistant(
      request.sessionId,
      response.text,
      intent.name,
    );

    return {
      request,
      intent,
      context,
      plan,
      execution,
      response,
    };
  } catch (thrown) {
    const stage = !intent
      ? "intent"
      : !context
        ? "context"
        : !plan
          ? "planning"
          : "execution";
    const structured = isPlatformError(thrown)
      ? errorHandler.handle(thrown, {
          logger,
          traceId: request.traceId,
          context: { stage },
        })
      : errorHandler.handle(thrown, {
          logger,
          traceId: request.traceId,
          category: "system",
          code: "pipeline_error",
          context: { stage },
        });
    const result = degradedPipelineResult(
      request,
      structured,
      {
        intent,
        context,
        plan,
      },
      platformRegistry,
    );
    contextManager.recordAssistant(
      request.sessionId,
      result.response.text,
      result.intent.name,
    );
    return result;
  }
}
