import { describe, expect, it } from "vitest";

import { createPlatformManager } from "../../manager.js";
import { createNodeEnvService } from "../../node/shared.js";
import { createPathService } from "../../node/paths.js";
import { PlatformError } from "../errors.js";
import type { OperatingSystem } from "../types.js";
import { createLinuxOperatingSystem, parseLinuxProcessList } from "./index.js";
import type {
  LinuxCommandResult,
  LinuxCommandRunner,
  LinuxCommandRunOptions,
} from "./runner.js";

function mockRunner(
  handler: (
    command: string,
    args: string[],
    options?: LinuxCommandRunOptions,
  ) => Promise<LinuxCommandResult> | LinuxCommandResult,
): LinuxCommandRunner {
  return {
    async run(command, args, options) {
      return handler(command, args, options);
    },
  };
}

function baseOs(
  runner: LinuxCommandRunner,
  envOverrides: Record<string, string> = {},
): OperatingSystem {
  const env = createNodeEnvService(envOverrides);
  const paths = createPathService("linux", {
    env,
    homeDir: "/home/test",
  });
  return createLinuxOperatingSystem({
    info: {
      id: "linux",
      os: "linux",
      arch: "x64",
      kernelVersion: "6.1.0",
      osType: "Linux",
      runtime: { kind: "node", version: "22.0.0" },
    },
    paths,
    env,
    runner,
  });
}

describe("Linux OperatingSystem interface", () => {
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
    expect(os.system.getPlatform().id).toBe("linux");
    expect(os.system.getPlatform().os).toBe("linux");
  });

  it("open invokes gtk-launch for bare app ids", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.open("firefox");
    expect(calls[0]?.command).toBe("gtk-launch");
    expect(calls[0]?.args).toEqual(["firefox"]);
  });

  it("open uses xdg-open for paths and URLs", async () => {
    const calls: { command: string; args: string[] }[] = [];
    const os = baseOs(
      mockRunner(async (command, args) => {
        calls.push({ command, args });
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    );
    await os.applications.open("/usr/share/apps/foo.desktop");
    expect(calls[0]?.command).toBe("xdg-open");
    expect(calls[0]?.args).toEqual(["/usr/share/apps/foo.desktop"]);
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

  it("clipboard prefers wl-* when WAYLAND_DISPLAY is set", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const os = baseOs(
      mockRunner(async (command, args, options) => {
        calls.push({ command, args, input: options?.input });
        if (command === "wl-paste") {
          return { stdout: "clip-text", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      { WAYLAND_DISPLAY: "wayland-0" },
    );
    expect(await os.clipboard.readText()).toBe("clip-text");
    await os.clipboard.writeText("hello");
    expect(calls.some((c) => c.command === "wl-paste")).toBe(true);
    expect(
      calls.some((c) => c.command === "wl-copy" && c.input === "hello"),
    ).toBe(true);
  });

  it("clipboard falls back to xclip when not on Wayland", async () => {
    const calls: { command: string; args: string[]; input?: string }[] = [];
    const os = baseOs(
      mockRunner(async (command, args, options) => {
        calls.push({ command, args, input: options?.input });
        if (command === "xclip" && args.includes("-o")) {
          return { stdout: "x11-text", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      { DISPLAY: ":0", XDG_SESSION_TYPE: "x11" },
    );
    expect(await os.clipboard.readText()).toBe("x11-text");
    await os.clipboard.writeText("hello");
    expect(
      calls.some(
        (c) =>
          c.command === "xclip" &&
          c.args.includes("-selection") &&
          c.args.includes("clipboard"),
      ),
    ).toBe(true);
  });

  it("listRunning parses ps fixture", async () => {
    const os = baseOs(
      mockRunner(async () => ({
        stdout: "  123 firefox\n  456 gnome-shell\n",
        stderr: "",
        exitCode: 0,
      })),
    );
    const running = await os.applications.listRunning();
    expect(running).toEqual([
      { id: "123", name: "firefox", pid: 123 },
      { id: "456", name: "gnome-shell", pid: 456 },
    ]);
  });

  it("parseLinuxProcessList skips malformed lines", () => {
    const rows = parseLinuxProcessList("1 init\nbad\n2 bash");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe("init");
  });
});

describe("Linux provider auto-registration", () => {
  it("PlatformManager linux uses Linux applications (not stub)", async () => {
    const calls: string[] = [];
    const manager = createPlatformManager({
      platformId: "linux",
      enforceOsPermissions: false,
      linuxRunner: mockRunner(async (command) => {
        calls.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    });
    await manager.getServices().os.applications.open("firefox");
    expect(calls).toContain("gtk-launch");
  });
});
