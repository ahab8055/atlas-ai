import { describe, expect, it } from "vitest";

import { parseCliArgs } from "./parse-args.js";

describe("parseCliArgs", () => {
  it("parses a plain command", () => {
    const options = parseCliArgs(["status"], {});
    expect(options.commandArgs).toEqual(["status"]);
    expect(options.interactive).toBe(false);
    expect(options.debug).toBe(false);
    expect(options.quiet).toBe(false);
  });

  it("strips a leading pnpm -- separator", () => {
    const options = parseCliArgs(["--", "echo", "hi"], {});
    expect(options.commandArgs).toEqual(["echo", "hi"]);
  });

  it("enables debug and interactive flags", () => {
    const options = parseCliArgs(
      ["-d", "-i", "--session", "dev-1", "help"],
      {},
    );
    expect(options.debug).toBe(true);
    expect(options.interactive).toBe(true);
    expect(options.sessionId).toBe("dev-1");
    expect(options.commandArgs).toEqual(["help"]);
    expect(options.quiet).toBe(false);
    expect(options.enableDatabase).toBe(true);
  });

  it("parses database flags", () => {
    const withPath = parseCliArgs(["--db", "/tmp/atlas.sqlite", "status"], {});
    expect(withPath.databasePath).toBe("/tmp/atlas.sqlite");
    expect(withPath.enableDatabase).toBe(true);

    const disabled = parseCliArgs(["--no-db", "status"], {});
    expect(disabled.enableDatabase).toBe(false);
  });

  it("respects env quiet/debug defaults", () => {
    const quiet = parseCliArgs(["ping"], { ATLAS_CLI_QUIET: "1" });
    expect(quiet.quiet).toBe(true);

    const debug = parseCliArgs(["ping"], { ATLAS_CLI_DEBUG: "1" });
    expect(debug.debug).toBe(true);
    expect(debug.quiet).toBe(false);
  });

  it("forwards command-local flags after the command name", () => {
    const options = parseCliArgs(
      ["--quiet", "history", "--limit", "5", "--status", "failed"],
      {},
    );
    expect(options.quiet).toBe(true);
    expect(options.commandArgs).toEqual([
      "history",
      "--limit",
      "5",
      "--status",
      "failed",
    ]);
  });

  it("rejects unknown global options before the command", () => {
    expect(() => parseCliArgs(["--nope"], {})).toThrow(/Unknown option/);
  });
});
