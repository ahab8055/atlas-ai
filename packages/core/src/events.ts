/**
 * Orchestration events from Architecture/22-AI-Orchestration-Architecture.md.
 * Emitted as structured log messages for MVP tracing (local event bus later).
 */
export const ORCHESTRATION_EVENTS = [
  "RequestReceived",
  "IntentDetected",
  "ContextLoaded",
  "PlanCreated",
  "ExecutionStarted",
  "ExecutionCompleted",
  "ResponseGenerated",
] as const;

export type OrchestrationEvent = (typeof ORCHESTRATION_EVENTS)[number];
