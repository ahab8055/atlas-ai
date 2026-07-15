import { shouldLog } from "./levels.js";
import { redactContext, toLogError } from "./redact.js";
import { createConsoleSink } from "./sinks.js";
import type {
  AtlasLogLevel,
  LogCategory,
  LogMethodOptions,
  LogRecord,
  LoggerOptions,
  LogSink,
} from "./types.js";

export class Logger {
  private readonly service: string;
  private readonly level: AtlasLogLevel;
  private readonly defaultCategory: LogCategory;
  private readonly sink: LogSink;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.level = options.level ?? "info";
    this.defaultCategory = options.category ?? "application";
    this.sink = options.sink ?? createConsoleSink();
  }

  child(serviceSuffix: string, overrides?: Partial<LoggerOptions>): Logger {
    return new Logger({
      service: `${this.service}.${serviceSuffix}`,
      level: overrides?.level ?? this.level,
      category: overrides?.category ?? this.defaultCategory,
      sink: overrides?.sink ?? this.sink,
    });
  }

  trace(message: string, options?: LogMethodOptions): void {
    this.write("trace", message, options);
  }

  debug(message: string, options?: LogMethodOptions): void {
    this.write("debug", message, options);
  }

  info(message: string, options?: LogMethodOptions): void {
    this.write("info", message, options);
  }

  warn(message: string, options?: LogMethodOptions): void {
    this.write("warn", message, options);
  }

  error(message: string, options?: LogMethodOptions): void {
    this.write("error", message, options);
  }

  critical(message: string, options?: LogMethodOptions): void {
    this.write("critical", message, options);
  }

  /** Log a failed operation with a normalized error payload for tracing. */
  logError(
    message: string,
    error: unknown,
    options?: Omit<LogMethodOptions, "error">,
  ): void {
    this.write("error", message, { ...options, error });
  }

  private write(
    level: AtlasLogLevel,
    message: string,
    options?: LogMethodOptions,
  ): void {
    if (!shouldLog(this.level, level)) {
      return;
    }

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      service: this.service,
      category: options?.category ?? this.defaultCategory,
      level,
      message,
      context: redactContext(options?.context),
      traceId: options?.traceId,
    };

    if (options?.error !== undefined) {
      record.error = toLogError(options.error);
    }

    this.sink.write(record);
  }
}

export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
