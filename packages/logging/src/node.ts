import { createConsoleSink, createMultiSink } from "./sinks.js";
import type { LogRecord, LogSink } from "./types.js";
import { formatLogRecord } from "./format.js";
import { mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";

export { createConsoleSink, createMultiSink };

/**
 * Node-only file sink (append JSONL). Import from `@atlas-ai/logging/node`
 * so browser bundles never pull in `node:fs`.
 */
export function createFileSink(filePath: string): LogSink {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  return {
    write(record: LogRecord) {
      appendFileSync(filePath, `${formatLogRecord(record)}\n`, "utf8");
    },
  };
}
