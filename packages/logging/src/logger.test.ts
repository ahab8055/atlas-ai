import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";
import { parseLogLevel, shouldLog } from "./levels.js";
import { redactContext, toLogError } from "./redact.js";
import type { LogRecord, LogSink } from "./types.js";

describe("shouldLog", () => {
  it("respects configured level threshold", () => {
    expect(shouldLog("info", "debug")).toBe(false);
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("warn", "error")).toBe(true);
  });
});

describe("parseLogLevel", () => {
  it("maps aliases and unknowns", () => {
    expect(parseLogLevel("warning")).toBe("warn");
    expect(parseLogLevel("fatal")).toBe("critical");
    expect(parseLogLevel("nope", "info")).toBe("info");
  });
});

describe("redactContext", () => {
  it("redacts sensitive keys", () => {
    const redacted = redactContext({
      user: "ada",
      apiKey: "secret",
      nested: { password: "x", ok: true },
    });

    expect(redacted).toEqual({
      user: "ada",
      apiKey: "[redacted]",
      nested: { password: "[redacted]", ok: true },
    });
  });
});

describe("toLogError", () => {
  it("normalizes Error instances", () => {
    const err = toLogError(new Error("boom"));
    expect(err.name).toBe("Error");
    expect(err.message).toBe("boom");
    expect(err.stack).toBeTypeOf("string");
  });
});

describe("createLogger", () => {
  it("writes structured records through the sink", () => {
    const records: LogRecord[] = [];
    const sink: LogSink = {
      write(record) {
        records.push(record);
      },
    };

    const log = createLogger({
      service: "test-service",
      level: "debug",
      sink,
    });

    log.info("hello", { context: { token: "abc" } });
    log.logError("failed", new Error("nope"));

    expect(records).toHaveLength(2);
    expect(records[0]?.message).toBe("hello");
    expect(records[0]?.context?.token).toBe("[redacted]");
    expect(records[1]?.error?.message).toBe("nope");
  });

  it("filters below configured level", () => {
    const write = vi.fn();
    const log = createLogger({
      service: "quiet",
      level: "error",
      sink: { write },
    });

    log.info("skipped");
    expect(write).not.toHaveBeenCalled();
  });
});
