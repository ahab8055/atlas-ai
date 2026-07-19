/**
 * Darwin ApplicationService via open / osascript (ADR-0064).
 */
import { PlatformError } from "../errors.js";
import type { ApplicationService, RunningApplication } from "../types.js";
import type { DarwinCommandRunner } from "./runner.js";

function looksLikePath(target: string): boolean {
  return (
    target.includes("/") ||
    target.startsWith("~") ||
    target.endsWith(".app") ||
    target.startsWith(".")
  );
}

function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function createDarwinApplicationService(
  runner: DarwinCommandRunner,
): ApplicationService {
  return {
    async open(appIdOrPath: string): Promise<void> {
      const target = appIdOrPath.trim();
      if (!target) {
        throw new PlatformError(
          "invalid_input",
          "ApplicationService.open requires a non-empty app id or path",
        );
      }
      const args = looksLikePath(target) ? [target] : ["-a", target];
      const result = await runner.run("open", args);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() ||
            `Failed to open application: ${target} (exit ${result.exitCode})`,
        );
      }
    },

    async listRunning(): Promise<RunningApplication[]> {
      // Tab-separated pid + name from System Events
      const script =
        'tell application "System Events" to get ' +
        "{unix id, name} of every process whose background only is false";
      const result = await runner.run("osascript", ["-e", script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "System Events process list failed",
        );
      }
      return parseDarwinProcessList(result.stdout);
    },

    async focus(pidOrId: string | number): Promise<void> {
      const script = buildFocusScript(pidOrId);
      const result = await runner.run("osascript", ["-e", script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to focus process: ${pidOrId}`,
        );
      }
    },

    async quit(pidOrId: string | number): Promise<void> {
      if (typeof pidOrId === "number" || /^\d+$/.test(String(pidOrId))) {
        const result = await runner.run("kill", [String(Number(pidOrId))]);
        if (result.exitCode !== 0 && result.exitCode !== null) {
          throw new PlatformError(
            "io_error",
            result.stderr.trim() || `Failed to quit pid: ${pidOrId}`,
          );
        }
        return;
      }
      const name = escapeAppleScript(String(pidOrId));
      const script = `tell application "${name}" to quit`;
      const result = await runner.run("osascript", ["-e", script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to quit application: ${pidOrId}`,
        );
      }
    },
  };
}

/**
 * Parse osascript list output. Formats vary; support:
 * - "123, TextEdit, 456, Safari" (flat list of pairs)
 * - lines "123\tTextEdit"
 */
export function parseDarwinProcessList(stdout: string): RunningApplication[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.includes("\t")) {
    const out: RunningApplication[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const [pidStr, ...rest] = line.split("\t");
      const name = rest.join("\t").trim();
      const pid = Number(pidStr);
      if (!name) {
        continue;
      }
      out.push({
        id: String(Number.isFinite(pid) ? pid : name),
        name,
        pid: Number.isFinite(pid) ? pid : undefined,
      });
    }
    return out;
  }

  // AppleScript often returns: 123, TextEdit, 456, Safari
  const parts = trimmed.split(",").map((p) => p.trim());
  const out: RunningApplication[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const pid = Number(parts[i]);
    const name = parts[i + 1] ?? "";
    if (!name) {
      continue;
    }
    out.push({
      id: String(Number.isFinite(pid) ? pid : name),
      name,
      pid: Number.isFinite(pid) ? pid : undefined,
    });
  }
  return out;
}

function buildFocusScript(pidOrId: string | number): string {
  if (typeof pidOrId === "number" || /^\d+$/.test(String(pidOrId))) {
    const pid = Number(pidOrId);
    return (
      `tell application "System Events" to set frontmost of ` +
      `(first process whose unix id is ${pid}) to true`
    );
  }
  const name = escapeAppleScript(String(pidOrId));
  return `tell application "${name}" to activate`;
}
