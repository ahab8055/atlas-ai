import { formatLogRecord } from "./format.js";
import type { AtlasLogLevel, LogRecord, LogSink } from "./types.js";

function writeConsole(level: AtlasLogLevel, line: string): void {
  switch (level) {
    case "trace":
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
    case "critical":
      console.error(line);
      break;
    default:
      console.log(line);
  }
}

/** Default sink: structured JSON lines to the console. */
export function createConsoleSink(): LogSink {
  return {
    write(record: LogRecord) {
      writeConsole(record.level, formatLogRecord(record));
    },
  };
}

export function createMultiSink(...sinks: LogSink[]): LogSink {
  return {
    write(record: LogRecord) {
      for (const sink of sinks) {
        sink.write(record);
      }
    },
  };
}
