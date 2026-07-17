import type { DetectedIntent } from "../intent/types.js";
import type { ExecutionPlan } from "../planning/types.js";
import type { ExecutionResult } from "../execution/types.js";
import type { NormalizedRequest } from "../types.js";
import { createAtlasError } from "../errors/index.js";
import {
  assembleResponse,
  assembleSpecialResponse,
  buildBlockedOrPartialBody,
  buildCancelledBody,
  buildCompletedBody,
  buildFailedBody,
} from "./builders.js";
import {
  buildHelpText,
  buildToolsListText,
  buildUnknownText,
} from "./intents.js";
import { modalityForSource } from "./status.js";
import type {
  GenerateResponseInput,
  PipelineResponse,
  ResponseGeneratorOptions,
} from "./types.js";

/**
 * Response generation module — converts execution results into user-facing messages.
 * Includes task status, clear errors/warnings, and voice-ready `spokenText`.
 */
export class ResponseGenerator {
  constructor(private readonly options: ResponseGeneratorOptions = {}) {}

  generate(input: GenerateResponseInput): PipelineResponse {
    const { request, intent, execution, plan, context } = input;
    const modality = this.options.modality ?? modalityForSource(request.source);
    const withTrace = { traceId: request.traceId };
    const memoryNote = formatRecalledMemoryNote(context);

    if (intent.name === "help") {
      const { text, spokenText } = buildHelpText();
      return assembleSpecialResponse({
        intent,
        execution,
        modality,
        summary: "Help",
        text,
        spokenText,
        nextSteps: [
          "Try status, Open VS Code, or Prepare my development environment.",
        ],
      });
    }

    if (intent.name === "tools.list") {
      const { text, spokenText } = buildToolsListText();
      return assembleSpecialResponse({
        intent,
        execution,
        modality,
        summary: "Tool registry",
        text,
        spokenText,
      });
    }

    if (!intent.known || intent.name === "unknown") {
      const { text, spokenText } = buildUnknownText(request);
      const structured = createAtlasError({
        category: "user",
        code: "unknown_intent",
        message: `Unrecognized request: ${request.text}`,
        traceId: request.traceId,
      });
      return {
        ...assembleSpecialResponse({
          intent,
          execution,
          modality,
          summary: "Unknown request",
          text,
          spokenText,
          nextSteps: structured.recovery.map((action) => action.description),
        }),
        errors: [structured.userMessage],
        structuredErrors: [structured],
      };
    }

    if (execution.status === "failed") {
      const body = buildFailedBody(execution);
      return assembleResponse({
        intent,
        execution,
        modality,
        summary: body.summary,
        textBody: body.textBody,
        spokenParts: body.spokenParts,
        errors: body.errors,
        warnings: [],
        nextSteps: body.nextSteps,
        ...withTrace,
      });
    }

    if (execution.status === "cancelled") {
      const body = buildCancelledBody(execution);
      return assembleResponse({
        intent,
        execution,
        modality,
        summary: body.summary,
        textBody: body.textBody,
        spokenParts: body.spokenParts,
        errors: body.errors,
        warnings: [],
        nextSteps: body.nextSteps,
        ...withTrace,
      });
    }

    if (execution.status === "blocked" || execution.status === "partial") {
      const body = buildBlockedOrPartialBody(intent, execution, plan);
      return assembleResponse({
        intent,
        execution,
        modality,
        summary: body.summary,
        textBody: body.textBody,
        spokenParts: body.spokenParts,
        errors: body.errors,
        warnings: body.warnings,
        nextSteps: body.nextSteps,
        ...withTrace,
      });
    }

    const body = buildCompletedBody(intent, execution, plan);
    const textBody = memoryNote
      ? [...body.textBody, "", memoryNote]
      : body.textBody;
    return assembleResponse({
      intent,
      execution,
      modality,
      summary: body.summary,
      textBody,
      spokenParts: body.spokenParts,
      errors: [],
      ...withTrace,
    });
  }
}

let defaultGenerator: ResponseGenerator | undefined;

export function getDefaultResponseGenerator(): ResponseGenerator {
  defaultGenerator ??= new ResponseGenerator();
  return defaultGenerator;
}

export function setDefaultResponseGenerator(
  generator: ResponseGenerator,
): void {
  defaultGenerator = generator;
}

/**
 * Convenience entry used by the pipeline respond stage.
 */
export function generateResponse(
  request: NormalizedRequest,
  intent: DetectedIntent,
  execution: ExecutionResult,
  plan?: ExecutionPlan,
  options?: ResponseGeneratorOptions,
  context?: GenerateResponseInput["context"],
): PipelineResponse {
  const generator = options
    ? new ResponseGenerator(options)
    : getDefaultResponseGenerator();
  return generator.generate({ request, intent, execution, plan, context });
}

function formatRecalledMemoryNote(
  context: GenerateResponseInput["context"],
): string | undefined {
  if (!context?.memories || context.memories.length === 0) {
    return undefined;
  }
  const lines = context.memories
    .slice(0, 3)
    .map((m) => `- ${m.content.trim()}`);
  if (lines.length === 0) {
    return undefined;
  }
  return `Recalled memories:\n${lines.join("\n")}`;
}
