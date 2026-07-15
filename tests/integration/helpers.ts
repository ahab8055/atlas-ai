/**
 * Shared harness for Phase 1 core-runtime integration tests.
 * Always injects isolated PermissionManager / EventBus / ContextManager.
 */
import { createLogger, type LogRecord } from "@atlas-ai/logging";
import {
  ContextManager,
  EventBus,
  ExecutionController,
  handleRequest,
  type IncomingRequest,
  type InputSource,
  type PipelineResult,
} from "@atlas-ai/core";
import {
  PermissionManager,
  type PermissionCapability,
} from "@atlas-ai/security";

export interface RuntimeHarness {
  logger: ReturnType<typeof createLogger>;
  records: LogRecord[];
  permissions: PermissionManager;
  executionController: ExecutionController;
  contextManager: ContextManager;
  eventBus: EventBus;
  handle: (
    rawInput: string,
    options?: { source?: InputSource; sessionId?: string },
  ) => PipelineResult;
  handleIncoming: (incoming: IncomingRequest) => PipelineResult;
}

export function createRuntimeHarness(options?: {
  grantedCapabilities?: Iterable<PermissionCapability>;
  logLevel?: "debug" | "info" | "warn" | "error";
}): RuntimeHarness {
  const records: LogRecord[] = [];
  const logger = createLogger({
    service: "phase1-integration",
    level: options?.logLevel ?? "info",
    sink: {
      write(record) {
        records.push(record);
      },
    },
  });

  const permissions = new PermissionManager({
    grantedCapabilities: options?.grantedCapabilities,
  });
  const executionController = new ExecutionController(permissions);
  const contextManager = new ContextManager();
  const eventBus = new EventBus({ historyLimit: 100 });

  const handleIncoming = (incoming: IncomingRequest): PipelineResult =>
    handleRequest(incoming, {
      logger,
      contextManager,
      executionController,
      eventBus,
    });

  return {
    logger,
    records,
    permissions,
    executionController,
    contextManager,
    eventBus,
    handleIncoming,
    handle(rawInput, opts = {}) {
      return handleIncoming({
        source: opts.source ?? "cli",
        rawInput,
        sessionId: opts.sessionId,
      });
    },
  };
}

/** Capabilities required to run the full "prepare development environment" plan. */
export const ENV_SETUP_GRANTS: PermissionCapability[] = [
  "application.control",
  "filesystem.read",
  "terminal.execute",
];

export function hasLoggedErrorCode(
  records: readonly LogRecord[],
  code: string,
): boolean {
  return records.some((record) => record.context?.errorCode === code);
}
