/**
 * Severity aligned with Architecture/15-Monitoring-Architecture.md
 * (Debug / Info / Warning / Error / Critical) plus `trace` for deep local debugging.
 */
export type AtlasLogLevel =
  "trace" | "debug" | "info" | "warn" | "error" | "critical";

/**
 * Log categories from Architecture/15-Monitoring-Architecture.md.
 */
export type LogCategory =
  "application" | "ai" | "tool" | "security" | "workflow";

export interface LogErrorFields {
  name: string;
  message: string;
  stack?: string;
}

/**
 * Structured log record (JSON-serializable).
 * Prepared for future local monitoring ingestion.
 */
export interface LogRecord {
  timestamp: string;
  service: string;
  category: LogCategory;
  level: AtlasLogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: LogErrorFields;
  /** Reserved for future distributed / request correlation. */
  traceId?: string;
}

export interface LoggerOptions {
  service: string;
  level?: AtlasLogLevel;
  /** Default category when callers do not specify one. */
  category?: LogCategory;
  /** Optional sink override (tests / file adapters). */
  sink?: LogSink;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export interface LogMethodOptions {
  category?: LogCategory;
  context?: Record<string, unknown>;
  error?: unknown;
  traceId?: string;
}
