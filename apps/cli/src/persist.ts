/**
 * Persist pipeline outcomes and sync in-memory tool registry into SQLite.
 */
import type { PipelineResult } from "@atlas-ai/core";
import { listToolMetadata } from "@atlas-ai/core";
import type { AtlasDatabase } from "@atlas-ai/database";

export function syncToolsToDatabase(database: AtlasDatabase): number {
  const tools = listToolMetadata();
  for (const tool of tools) {
    database.tools.upsert({
      name: tool.name,
      description: tool.description,
      version: tool.version,
      type: "system",
      risk: tool.risk,
      enabled: true,
      configuration: {
        permissions: tool.permissions,
      },
    });
  }
  return tools.length;
}

export function recordPipelineResult(
  database: AtlasDatabase,
  result: PipelineResult,
): void {
  database.executionHistory.record({
    taskId: result.execution.taskId,
    planId: result.plan.id,
    requestId: result.request.id,
    traceId: result.request.traceId,
    intent: result.intent.name,
    goal: result.plan.goal,
    status: result.execution.status,
    lifecycle: result.execution.lifecycle,
    progress: result.execution.progress,
    result: {
      responseStatus: result.response.status,
      summary: result.response.summary,
      errors: result.response.errors,
    },
    startedAt: result.execution.startedAt,
    finishedAt: result.execution.finishedAt,
    steps: result.execution.steps.map((step) => ({
      step: step.stepId,
      status: step.status,
      result: step.output,
      error: step.error,
    })),
  });
}
