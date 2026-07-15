import type { PipelineResult } from "@atlas-ai/core";

import type { CliOptions } from "./options.js";

/** Write Atlas user response to stdout (scriptable). */
export function displayResponse(result: PipelineResult): void {
  process.stdout.write(`${result.response.text}\n`);
}

/** Compact debug block after a turn (stderr only). */
export function displayDebugMeta(result: PipelineResult): void {
  const lines = [
    "[debug] --- result ---",
    `[debug] intent=${result.intent.name} known=${result.intent.known}`,
    `[debug] status=${result.response.status} lifecycle=${result.execution.lifecycle}`,
    `[debug] plan=${result.plan.id} kind=${result.plan.kind} steps=${result.plan.steps.length}`,
    `[debug] task=${result.execution.taskId} progress=${result.execution.progress.percent}%`,
    `[debug] errors=${result.response.errors.length} warnings=${result.response.warnings.length}`,
    `[debug] trace=${result.request.traceId}`,
  ];
  process.stderr.write(`${lines.join("\n")}\n`);
}

/** Exit code from pipeline outcome. */
export function exitCodeForResult(result: PipelineResult): number {
  return result.response.status === "completed" ? 0 : 1;
}

export function createDebugEventPrinter(): (
  type: string,
  summary: string,
) => void {
  return (type, summary) => {
    process.stderr.write(`[debug] event ${type} ${summary}\n`);
  };
}

export function shouldPrintDebugMeta(options: CliOptions): boolean {
  return options.debug;
}
