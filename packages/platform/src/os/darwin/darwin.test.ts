import { describe, expect, it } from "vitest";

import { createPlatformManager } from "../../manager.js";
import { createNodeEnvService } from "../../node/shared.js";
import { createPathService } from "../../node/paths.js";
import { PlatformError } from "../errors.js";
import type { OperatingSystem } from "../types.js";
import {
  createDarwinOperatingSystem,
  parseDarwinProcessList,
} from "./index.js";
import type {
  DarwinCommandResult,
  DarwinCommandRunner,
  DarwinCommandRunOptions,
} from "./runner.js";

function mockRunner(
  handler: (
    command: string,
    args: string[],
    options?: DarwinCommandRunOptions,
  ) => Promise<DarwinCommandResult> | DarwinCommandResult,
): DarwinCommandRunner {
  return {
    async run(command, args, options) {
      return handler(command, args, options);
    },
  };
}

function baseOs(runner: DarwinCommandRunner): OperatingSystem {
  const env = createNodeEnvService({});
  const paths = createPathService("darwin", {
    env,
    homeDir: "/Users/test",
  });
  return createDarwinOperatingSystem({
    info: {
      id: "darwin",
      os: "macos",
      arch: "arm64",
      kernelVersion: "24.0.0",
      osType: "Darwin",
      runtime: { kind: "node", version: "22.0.0" },
    },
    paths,
    env,
    runner,
  });
}

describe("Darwin OperatingSystem interface", () => {
  it("exposes all OperatingSystem capability keys", () => {
    const os = baseOs(
      mockRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    );
    for (const key of [
      "applications",
      "files",
      "terminal",
      "notifications",
      "clipboard",
      "system",
      "paths",
      "env",
    ] as const) {
      expect(os[key]).toBeDefined();
    }
    expect(os.system.getPlatform().id).toBe("darwin");
    expect(os.system.getPlatform().os).toBe("macos");
  });

  it("open invokes open -a for app names", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.open("TextEdit");
    expect(calls[0]?.command).toBe("open");
    expect(calls[0]?.args).toEqual(["-a", "TextEdit"]);
  });

  it("open uses path form for paths and .app bundles", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.open("/Applications/TextEdit.app");
    expect(calls[0]?.args).toEqual(["/Applications/TextEdit.app"]);
  });

  it("rejects empty open with invalid_input", async () => {
    const os = baseOs(
      mockRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    );
    await expect(os.applications.open("  ")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(os.applications.open("")).rejects.toBeInstanceOf(
      PlatformError,
    );
  });

  it("terminal.execute passes command and args through the runner", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "hi\n", stderr: "", exitCode: 0 };
      }),
    );
    const result = await os.terminal.execute("echo", ["hi"]);
    expect(calls[0]).toEqual({ command: "echo", args: ["hi"] });
    expect(result.stdout).toContain("hi");
  });

  it("clipboard read/write invoke pbpaste and pbcopy", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const os = baseOs(
      mockRunner(async (command, args, options) => {
        calls.push({ command, args, input: options?.input });
        if (command === "pbpaste") {
          return { stdout: "clip-text\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    expect(await os.clipboard.readText()).toBe("clip-text\n");
    await os.clipboard.writeText("hello");
    expect(calls.some((c) => c.command === "pbpaste")).toBe(true);
    expect(
      calls.some((c) => c.command === "pbcopy" && c.input === "hello"),
    ).toBe(true);
  });

  it("clipboard throws io_error on non-zero exit", async () => {
    const os = baseOs(
      mockRunner(async () => ({
        stdout: "",
        stderr: "fail",
        exitCode: 1,
      })),
    );
    await expect(os.clipboard.readText()).rejects.toMatchObject({
      code: "io_error",
    });
    await expect(os.clipboard.writeText("x")).rejects.toMatchObject({
      code: "io_error",
    });
  });

  it("listRunning parses osascript comma-pair fixture", async () => {
    const os = baseOs(
      mockRunner(async () => ({
        stdout: "123, TextEdit, 456, Safari",
        stderr: "",
        exitCode: 0,
      })),
    );
    const running = await os.applications.listRunning();
    expect(running).toEqual([
      { id: "123", name: "TextEdit", pid: 123 },
      { id: "456", name: "Safari", pid: 456 },
    ]);
  });

  it("parseDarwinProcessList handles tab-separated lines", () => {
    const rows = parseDarwinProcessList("1\tFinder\n2\tTerminal");
    expect(rows).toEqual([
      { id: "1", name: "Finder", pid: 1 },
      { id: "2", name: "Terminal", pid: 2 },
    ]);
  });
});

describe("Darwin provider auto-registration", () => {
  it("PlatformManager darwin uses Darwin applications (not stub)", async () => {
    const calls: string[] = [];
    const manager = createPlatformManager({
      platformId: "darwin",
      enforceOsPermissions: false,
      darwinRunner: mockRunner(async (command) => {
        calls.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    });
    await manager.getServices().os.applications.open("TextEdit");
    expect(calls).toContain("open");
  });
});

describe("Darwin focus quit notifications", () => {
  it("focus and quit invoke osascript or kill", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.focus(99);
    await os.applications.quit(99);
    await os.applications.quit("TextEdit");
    expect(calls.some((c) => c.command === "osascript")).toBe(true);
    expect(
      calls.some((c) => c.command === "kill" && c.args.includes("99")),
    ).toBe(true);
  });

  it("notifications.show uses osascript display notification", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.notifications.show({ title: "Hi", body: "There" });
    expect(calls[0]?.command).toBe("osascript");
    expect(calls[0]?.args[1]).toContain("display notification");
    await expect(
      os.notifications.show({ title: "", body: "" }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("notifications.show throws on osascript failure", async () => {
    const os = baseOs(
      mockRunner(async () => ({
        stdout: "",
        stderr: "fail",
        exitCode: 1,
      })),
    );
    await expect(
      os.notifications.show({ title: "Hi", body: "There" }),
    ).rejects.toMatchObject({ code: "io_error" });
  });

  it("terminal.execute rejects empty command", async () => {
    const os = baseOs(
      mockRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    );
    await expect(os.terminal.execute("", [])).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
