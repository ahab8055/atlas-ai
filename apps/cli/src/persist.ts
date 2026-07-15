/**
 * Persist pipeline outcomes and sync in-memory tool registry into SQLite.
 */
import {
  createModelRegistry,
  createPersistentModelRegistryStore,
} from "@atlas-ai/ai";
import { loadConfig } from "@atlas-ai/config";
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

/** Scan `models/` for GGUF files and upsert into the persistent models table. */
export function syncModelsToDatabase(database: AtlasDatabase): number {
  const config = loadConfig();
  const registry = createModelRegistry({
    store: createPersistentModelRegistryStore(database.models),
    modelsDir: config.paths.modelsDir,
    defaultProvider:
      config.ai.provider === "mock" ? "llamacpp" : config.ai.provider,
    defaultContextLength: config.ai.hardware.contextSize,
  });
  return registry.syncFromDisk();
}

export function recordPipelineResult(
  database: AtlasDatabase,
  result: PipelineResult,
): void {
  database.taskHistory.record({
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
      warnings: result.response.warnings,
    },
    failures: result.execution.failures.map((failure) => ({
      stepId: failure.stepId,
      message: failure.message,
      code: failure.code,
      at: failure.at,
    })),
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
