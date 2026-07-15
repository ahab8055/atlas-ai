import type { LogRecord } from "./types.js";

/** Serialize a log record as a single JSON line (monitoring-friendly). */
export function formatLogRecord(record: LogRecord): string {
  return JSON.stringify(record);
}
