/**
 * Linux ApplicationService via xdg-open / gtk-launch / ps (ADR-0065).
 */
import { PlatformError } from "../errors.js";
import type { ApplicationService, RunningApplication } from "../types.js";
import type { LinuxCommandRunner } from "./runner.js";

function looksLikePathOrUrl(target: string): boolean {
  return (
    target.includes("/") ||
    target.includes("://") ||
    target.startsWith("file:") ||
    target.startsWith("~") ||
    target.startsWith(".")
  );
}

function isCommandMissing(error: unknown): boolean {
  if (!(error instanceof PlatformError)) {
    return false;
  }
  if (error.detail?.errno === "ENOENT" || error.code === "resource_not_found") {
    return true;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("enoent") ||
    msg.includes("not found") ||
    msg.includes("no such file")
  );
}

export function createLinuxApplicationService(
  runner: LinuxCommandRunner,
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

      if (looksLikePathOrUrl(target)) {
        const result = await runner.run("xdg-open", [target]);
        if (result.exitCode !== 0 && result.exitCode !== null) {
          throw new PlatformError(
            "io_error",
            result.stderr.trim() ||
              `Failed to open: ${target} (exit ${result.exitCode})`,
          );
        }
        return;
      }

      // Bare app id: prefer gtk-launch, fall back to xdg-open
      try {
        const launch = await runner.run("gtk-launch", [target]);
        if (launch.exitCode === 0 || launch.exitCode === null) {
          return;
        }
      } catch (error) {
        if (!isCommandMissing(error)) {
          throw error;
        }
      }

      const fallback = await runner.run("xdg-open", [target]);
      if (fallback.exitCode !== 0 && fallback.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          fallback.stderr.trim() ||
            `Failed to open application: ${target} (exit ${fallback.exitCode})`,
        );
      }
    },

    async listRunning(): Promise<RunningApplication[]> {
      const result = await runner.run("ps", ["-eo", "pid=,comm="]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "ps process list failed",
        );
      }
      return parseLinuxProcessList(result.stdout);
    },

    async focus(pidOrId: string | number): Promise<void> {
      if (typeof pidOrId === "number" || /^\d+$/.test(String(pidOrId))) {
        const pid = String(Number(pidOrId));
        let search;
        try {
          search = await runner.run("xdotool", ["search", "--pid", pid]);
        } catch (error) {
          throw new PlatformError(
            "io_error",
            isCommandMissing(error)
              ? "xdotool is required to focus by pid (not installed or not found)"
              : error instanceof Error
                ? error.message
                : String(error),
          );
        }
        if (search.exitCode !== 0 && search.exitCode !== null) {
          throw new PlatformError(
            "io_error",
            search.stderr.trim() || `No window found for pid ${pid}`,
          );
        }
        const windowId = search.stdout.trim().split(/\s+/)[0];
        if (!windowId) {
          throw new PlatformError("io_error", `No window found for pid ${pid}`);
        }
        const activate = await runner.run("xdotool", [
          "windowactivate",
          windowId,
        ]);
        if (activate.exitCode !== 0 && activate.exitCode !== null) {
          throw new PlatformError(
            "io_error",
            activate.stderr.trim() || `Failed to focus pid: ${pid}`,
          );
        }
        return;
      }

      const name = String(pidOrId);
      let result;
      try {
        result = await runner.run("wmctrl", ["-a", name]);
      } catch (error) {
        throw new PlatformError(
          "io_error",
          isCommandMissing(error)
            ? "wmctrl is required to focus by name (not installed or not found)"
            : error instanceof Error
              ? error.message
              : String(error),
        );
      }
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to focus window: ${name}`,
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
      const result = await runner.run("pkill", ["-x", String(pidOrId)]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to quit process: ${pidOrId}`,
        );
      }
    },
  };
}

/**
 * Parse `ps -eo pid=,comm=` output (pid and command name per line).
 */
export function parseLinuxProcessList(stdout: string): RunningApplication[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  const out: RunningApplication[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    const name = match[2].trim();
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
