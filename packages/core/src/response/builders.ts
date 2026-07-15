import type { DetectedIntent } from "../intent/types.js";
import type { ExecutionPlan } from "../planning/types.js";
import type { ExecutionResult } from "../execution/types.js";
import { formatPlanSteps } from "../planning/builders.js";
import {
  collectWarnings,
  explainFailures,
  fallbackErrorMessage,
} from "./errors.js";
import { formatProgress, lifecycleLabel, statusLabel } from "./status.js";
import type { PipelineResponse, ResponseModality } from "./types.js";

function joinBody(lines: string[]): string {
  return lines.filter((line) => line.length > 0).join("\n");
}

function speakable(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

function stepOutputs(execution: ExecutionResult): string {
  return execution.steps
    .filter((s) => s.output)
    .map((s) => s.output)
    .join("\n");
}

function formatParamsInline(intent: DetectedIntent): string {
  const entries = Object.entries(intent.parameters).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  if (entries.length === 0) {
    return "(none)";
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

export function assembleResponse(input: {
  intent: DetectedIntent;
  execution: ExecutionResult;
  modality: ResponseModality;
  summary: string;
  textBody: string[];
  spokenParts: string[];
  errors?: string[];
  warnings?: string[];
  nextSteps?: string[];
}): PipelineResponse {
  const errors = input.errors ?? explainFailures(input.execution.failures);
  const warnings = input.warnings ?? collectWarnings(input.execution);
  const nextSteps = input.nextSteps ?? [];

  const statusLine = `Task status: ${statusLabel(input.execution.status)}`;
  const lifecycleLine = input.execution.lifecycle
    ? `Lifecycle: ${lifecycleLabel(input.execution.lifecycle)}`
    : "";
  const progressLine = `Progress: ${formatProgress(input.execution.progress)}`;

  const text = joinBody([
    input.summary,
    statusLine,
    lifecycleLine,
    progressLine,
    ...input.textBody,
    errors.length > 0
      ? ["", "Errors:", ...errors.map((e) => `- ${e}`)].join("\n")
      : "",
    warnings.length > 0
      ? ["", "Warnings:", ...warnings.map((w) => `- ${w}`)].join("\n")
      : "",
    nextSteps.length > 0
      ? ["", "Next steps:", ...nextSteps.map((n) => `- ${n}`)].join("\n")
      : "",
  ]);

  const spokenText = speakable([
    input.summary,
    `Status: ${statusLabel(input.execution.status)}.`,
    ...input.spokenParts,
    errors.length > 0 ? `Errors: ${errors.join(" ")}` : "",
    warnings.length > 0 ? `Warnings: ${warnings.join(" ")}` : "",
    nextSteps.length > 0 ? `Next: ${nextSteps.join(" ")}` : "",
  ]);

  return {
    text,
    spokenText,
    summary: input.summary,
    intent: input.intent.name,
    status: input.execution.status,
    lifecycle: input.execution.lifecycle,
    errors,
    warnings,
    nextSteps,
    modality: input.modality,
  };
}

/** Special intents keep bespoke copy but still carry status / voice fields. */
export function assembleSpecialResponse(input: {
  intent: DetectedIntent;
  execution: ExecutionResult;
  modality: ResponseModality;
  summary: string;
  text: string;
  spokenText: string;
  nextSteps?: string[];
}): PipelineResponse {
  const statusLine = `Task status: ${statusLabel(input.execution.status)}`;
  const progressLine = `Progress: ${formatProgress(input.execution.progress)}`;
  const text = [input.text, "", statusLine, progressLine].join("\n");
  const spokenText = [
    input.spokenText,
    `Status: ${statusLabel(input.execution.status)}.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    spokenText,
    summary: input.summary,
    intent: input.intent.name,
    status: input.execution.status,
    lifecycle: input.execution.lifecycle,
    errors: [],
    warnings: [],
    nextSteps: input.nextSteps ?? [],
    modality: input.modality,
  };
}

export function buildCompletedBody(
  intent: DetectedIntent,
  execution: ExecutionResult,
  plan?: ExecutionPlan,
): { textBody: string[]; spokenParts: string[]; summary: string } {
  const outputs = stepOutputs(execution);

  if (plan?.kind === "multi" && outputs) {
    return {
      summary: `Plan complete: ${plan.goal}`,
      textBody: [outputs],
      spokenParts: [
        `I finished the plan to ${plan.goal}.`,
        outputs.replace(/\n/g, ". "),
      ],
    };
  }

  if (outputs) {
    return {
      summary: intent.goal,
      textBody: [outputs],
      spokenParts: [outputs.replace(/\n/g, ". ")],
    };
  }

  return {
    summary: `${intent.goal} (${intent.category})`,
    textBody: [],
    spokenParts: [`${intent.goal} finished successfully.`],
  };
}

export function buildFailedBody(execution: ExecutionResult): {
  textBody: string[];
  spokenParts: string[];
  summary: string;
  errors: string[];
  nextSteps: string[];
} {
  const errors = explainFailures(execution.failures);
  if (errors.length === 0) {
    errors.push(
      `${fallbackErrorMessage(execution)}. A tool or step reported a failure without details.`,
    );
  }
  return {
    summary: "Request failed",
    textBody: [],
    spokenParts: ["The request failed."],
    errors,
    nextSteps: [
      "Review the error detail above.",
      "Retry the command, or run help for supported intents.",
    ],
  };
}

export function buildCancelledBody(execution: ExecutionResult): {
  textBody: string[];
  spokenParts: string[];
  summary: string;
  errors: string[];
  nextSteps: string[];
} {
  const detail = execution.failures[0]?.message ?? "Cancelled by request";
  return {
    summary: "Execution cancelled",
    textBody: [detail],
    spokenParts: [`Execution was cancelled. ${detail}.`],
    errors: explainFailures(execution.failures),
    nextSteps: ["Run the command again when you are ready to continue."],
  };
}

export function buildBlockedOrPartialBody(
  intent: DetectedIntent,
  execution: ExecutionResult,
  plan?: ExecutionPlan,
): {
  textBody: string[];
  spokenParts: string[];
  summary: string;
  errors: string[];
  warnings: string[];
  nextSteps: string[];
} {
  const reason = fallbackErrorMessage(execution);
  const errors = explainFailures(execution.failures);
  const warnings = collectWarnings(execution);
  const textBody: string[] = [
    `Understood: ${intent.goal}`,
    `Category: ${intent.category}`,
    `Parameters: ${formatParamsInline(intent)}`,
  ];
  if (plan) {
    textBody.push(`Plan (${plan.kind}): ${plan.goal}`, formatPlanSteps(plan));
  }
  textBody.push(`Detail: ${reason}`);

  const nextSteps =
    execution.status === "blocked"
      ? [
          "Approve or deny the pending permission in Atlas.",
          "Re-run the command after granting access.",
        ]
      : [
          "Review blocked or failed steps.",
          "Approve any pending permissions, then retry if needed.",
        ];

  return {
    summary:
      execution.status === "blocked"
        ? `Blocked: ${intent.goal}`
        : `Partial result: ${intent.goal}`,
    textBody,
    spokenParts: [
      execution.status === "blocked"
        ? `I understood your request to ${intent.goal}, but it is blocked.`
        : `I partly completed your request to ${intent.goal}.`,
      reason,
    ],
    errors,
    warnings,
    nextSteps,
  };
}
