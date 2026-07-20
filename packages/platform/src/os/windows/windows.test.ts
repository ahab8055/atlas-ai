import { describe, expect, it } from "vitest";

import { createPlatformManager } from "../../manager.js";
import { createNodeEnvService } from "../../node/shared.js";
import { createPathService } from "../../node/paths.js";
import { PlatformError } from "../errors.js";
import type { OperatingSystem } from "../types.js";
import { createWindowsOperatingSystem, parseProcessList } from "./index.js";
import type {
  WindowsCommandResult,
  WindowsCommandRunner,
  WindowsCommandRunOptions,
} from "./runner.js";

function mockRunner(
  handler: (
    command: string,
    args: string[],
    options?: WindowsCommandRunOptions,
  ) => Promise<WindowsCommandResult> | WindowsCommandResult,
): WindowsCommandRunner {
  return {
    async run(command, args, options) {
      return handler(command, args, options);
    },
  };
}

function baseOs(runner: WindowsCommandRunner): OperatingSystem {
  const env = createNodeEnvService({});
  const paths = createPathService("win32", {
    env,
    homeDir: "C:\\Users\\test",
  });
  return createWindowsOperatingSystem({
    info: {
      id: "win32",
      os: "windows",
      arch: "x64",
      kernelVersion: "10.0.22631",
      osType: "Windows_NT",
      runtime: { kind: "node", version: "22.0.0" },
    },
    paths,
    env,
    runner,
  });
}

describe("Windows OperatingSystem interface", () => {
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
    expect(os.system.getPlatform().id).toBe("win32");
    expect(os.system.getPlatform().os).toBe("windows");
  });

  it("open invokes cmd.exe start with target", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.open("notepad");
    expect(calls[0]?.command).toBe("cmd.exe");
    expect(calls[0]?.args).toEqual(["/c", "start", "", "notepad"]);
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
        return { stdout: "hi\r\n", stderr: "", exitCode: 0 };
      }),
    );
    const result = await os.terminal.execute("echo", ["hi"]);
    expect(calls[0]).toEqual({ command: "echo", args: ["hi"] });
    expect(result.stdout).toContain("hi");
  });

  it("clipboard read/write invoke PowerShell and clip.exe", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const os = baseOs(
      mockRunner(async (command, args, options) => {
        calls.push({ command, args, input: options?.input });
        if (command === "powershell.exe") {
          return { stdout: "clip-text\r\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    expect(await os.clipboard.readText()).toBe("clip-text");
    await os.clipboard.writeText("hello");
    expect(calls.some((c) => c.command === "powershell.exe")).toBe(true);
    expect(
      calls.some((c) => c.command === "clip.exe" && c.input === "hello"),
    ).toBe(true);
  });

  it("clipboard write falls back to Set-Clipboard when clip.exe fails", async () => {
    const calls: string[] = [];
    const os = baseOs(
      mockRunner(async (command) => {
        calls.push(command);
        if (command === "clip.exe") {
          return { stdout: "", stderr: "fail", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.clipboard.writeText("hello");
    expect(calls).toContain("clip.exe");
    expect(calls.filter((c) => c === "powershell.exe").length).toBeGreaterThan(
      0,
    );
  });

  it("listRunning parses Get-Process JSON fixture", async () => {
    const fixture = JSON.stringify([
      { Id: 100, ProcessName: "notepad", Path: "C:\\Windows\\notepad.exe" },
      { Id: 200, ProcessName: "pwsh", Path: null },
    ]);
    const os = baseOs(
      mockRunner(async () => ({
        stdout: fixture,
        stderr: "",
        exitCode: 0,
      })),
    );
    const running = await os.applications.listRunning();
    expect(running).toEqual([
      {
        id: "100",
        name: "notepad",
        pid: 100,
        path: "C:\\Windows\\notepad.exe",
      },
      { id: "200", name: "pwsh", pid: 200, path: undefined },
    ]);
  });

  it("parseProcessList handles single-object JSON", () => {
    const rows = parseProcessList(
      JSON.stringify({ Id: 1, ProcessName: "explorer", Path: "C:\\e.exe" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("explorer");
  });
});

describe("Windows provider auto-registration", () => {
  it("PlatformManager win32 uses Windows applications (not stub)", async () => {
    const calls: string[] = [];
    const manager = createPlatformManager({
      platformId: "win32",
      enforceOsPermissions: false,
      windowsRunner: mockRunner(async (command) => {
        calls.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    });
    await manager.getServices().os.applications.open("calc");
    expect(calls).toContain("cmd.exe");
  });
});

describe("Windows focus quit notifications", () => {
  it("focus and quit invoke powershell", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.focus(100);
    await os.applications.quit(100);
    expect(calls.every((c) => c.command === "powershell.exe")).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("notifications.show invokes powershell balloon tip", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.notifications.show({ title: "Title", body: "Body" });
    expect(calls[0]?.command).toBe("powershell.exe");
    expect(calls[0]?.args.join(" ")).toContain("BalloonTipTitle");
    await expect(
      os.notifications.show({ title: "  ", body: "" }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("notifications.show throws on powershell failure", async () => {
    const os = baseOs(
      mockRunner(async () => ({
        stdout: "",
        stderr: "fail",
        exitCode: 1,
      })),
    );
    await expect(
      os.notifications.show({ title: "Title", body: "Body" }),
    ).rejects.toMatchObject({ code: "io_error" });
  });
});
