import type { DetectedIntent } from "../intent/types.js";
import type { ExecutionPlan } from "../planning/types.js";
import type { ExecutionResult } from "../execution/types.js";
import type { NormalizedRequest } from "../types.js";
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
    const { request, intent, execution, plan } = input;
    const modality = this.options.modality ?? modalityForSource(request.source);

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
      return assembleSpecialResponse({
        intent,
        execution,
        modality,
        summary: "Unknown request",
        text,
        spokenText,
        nextSteps: [
          "Try: help · Open VS Code · Prepare my development environment",
        ],
      });
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
      });
    }

    const body = buildCompletedBody(intent, execution, plan);
    return assembleResponse({
      intent,
      execution,
      modality,
      summary: body.summary,
      textBody: body.textBody,
      spokenParts: body.spokenParts,
      errors: [],
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
): PipelineResponse {
  const generator = options
    ? new ResponseGenerator(options)
    : getDefaultResponseGenerator();
  return generator.generate({ request, intent, execution, plan });
}
