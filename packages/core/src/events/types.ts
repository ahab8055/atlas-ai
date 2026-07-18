/**
 * Core orchestration event types (Architecture/22 + user story).
 * Architecture/10 names these as event `type` on the envelope.
 */
export const CORE_EVENTS = [
  "RequestReceived",
  "IntentDetected",
  "ContextLoaded",
  "PlanCreated",
  "ExecutionStarted",
  "ExecutionCompleted",
  "ResponseGenerated",
] as const;

export type CoreEventType = (typeof CORE_EVENTS)[number];

/** @deprecated Prefer CORE_EVENTS — kept for pipeline log compatibility. */
export const ORCHESTRATION_EVENTS = CORE_EVENTS;

/** @deprecated Prefer CoreEventType */
export type OrchestrationEvent = CoreEventType;

/**
 * Standard event envelope (Architecture/10 Event Data Model).
 */
export interface AtlasEvent<
  TType extends string = string,
  TPayload = Record<string, unknown>,
> {
  /** Unique event id (e.g. evt_…). */
  id: string;
  /** Event type / name. */
  type: TType;
  /** ISO-8601 creation time. */
  timestamp: string;
  /** Component that published the event. */
  source: string;
  /** Optional correlation id for a request pipeline run. */
  traceId?: string;
  /** Type-specific data. */
  payload: TPayload;
}

/** Typed payloads for core orchestration events. */
export interface CoreEventPayloadMap {
  RequestReceived: {
    stage: "normalize";
    inputSource: string;
    sessionId: string;
    textLength: number;
  };
  IntentDetected: {
    stage: "intent";
    intent: string;
    category: string;
    goal: string;
    confidence: number;
    complexity: string;
    known: boolean;
    parameters: Record<string, unknown>;
    capabilities: string[];
  };
  ContextLoaded: {
    stage: "context";
    sources: string[];
    turnCount: number;
    memoryCount: number;
    knowledgeCount: number;
    activeTaskCount: number;
    preferredEditor?: string;
    project?: string;
    runtime?: string;
    conversationSummary?: string;
    packageSections?: number;
    packageChars?: number;
  };
  PlanCreated: {
    stage: "planning";
    planId: string;
    goal: string;
    kind: string;
    stepCount: number;
    requiresApproval: boolean;
    steps: Array<{
      order: number;
      id: string;
      tool?: string;
      capability?: string;
    }>;
  };
  ExecutionStarted: {
    stage: "execution";
    planId: string;
    stepCount: number;
  };
  ExecutionCompleted: {
    stage: "execution";
    taskId: string;
    status: string;
    lifecycle: string;
    progress: Record<string, unknown>;
    failures: unknown[];
    steps: Array<{ id: string; status: string }>;
  };
  ResponseGenerated: {
    stage: "response";
    intent: string;
    status: string;
    summary: string;
    modality: string;
    errorCount: number;
    warningCount: number;
    responseLength: number;
    spokenLength: number;
  };
}

export type CoreAtlasEvent<T extends CoreEventType = CoreEventType> =
  AtlasEvent<T, CoreEventPayloadMap[T]>;

export type EventHandler<TEvent extends AtlasEvent = AtlasEvent> = (
  event: TEvent,
) => void;

export type Unsubscribe = () => void;

export interface PublishInput<
  TType extends string = string,
  TPayload = Record<string, unknown>,
> {
  type: TType;
  source: string;
  payload: TPayload;
  traceId?: string;
  id?: string;
  timestamp?: string;
}
