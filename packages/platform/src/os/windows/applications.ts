/**
 * Windows ApplicationService via cmd / PowerShell (ADR-0063).
 */
import { PlatformError } from "../errors.js";
import type { ApplicationService, RunningApplication } from "../types.js";
import type { WindowsCommandRunner } from "./runner.js";

const PS = "powershell.exe";
const PS_FLAGS = ["-NoProfile", "-NonInteractive", "-Command"] as const;

function escapePsSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function createWindowsApplicationService(
  runner: WindowsCommandRunner,
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
      // cmd /c start "" <target> — empty title required by start semantics
      const result = await runner.run("cmd.exe", ["/c", "start", "", target]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() ||
            `Failed to open application: ${target} (exit ${result.exitCode})`,
        );
      }
    },

    async listRunning(): Promise<RunningApplication[]> {
      const script =
        "Get-Process | Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress";
      const result = await runner.run(PS, [...PS_FLAGS, script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "Get-Process failed",
        );
      }
      return parseProcessList(result.stdout);
    },

    async focus(pidOrId: string | number): Promise<void> {
      const script = buildFocusScript(pidOrId);
      const result = await runner.run(PS, [...PS_FLAGS, script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to focus process: ${pidOrId}`,
        );
      }
    },

    async quit(pidOrId: string | number): Promise<void> {
      const script = buildQuitScript(pidOrId);
      const result = await runner.run(PS, [...PS_FLAGS, script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || `Failed to quit process: ${pidOrId}`,
        );
      }
    },
  };
}

export function parseProcessList(stdout: string): RunningApplication[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new PlatformError(
      "io_error",
      "Failed to parse Get-Process JSON output",
    );
  }
  const rows = Array.isArray(data) ? data : [data];
  const out: RunningApplication[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const id = Number(r.Id);
    const name = String(r.ProcessName ?? "");
    if (!name) {
      continue;
    }
    out.push({
      id: String(Number.isFinite(id) ? id : name),
      name,
      pid: Number.isFinite(id) ? id : undefined,
      path:
        typeof r.Path === "string" && r.Path.length > 0 ? r.Path : undefined,
    });
  }
  return out;
}

function buildFocusScript(pidOrId: string | number): string {
  if (typeof pidOrId === "number" || /^\d+$/.test(String(pidOrId))) {
    const pid = Number(pidOrId);
    return (
      `$p = Get-Process -Id ${pid} -ErrorAction Stop; ` +
      `$wshell = New-Object -ComObject WScript.Shell; ` +
      `$wshell.AppActivate($p.Id) | Out-Null`
    );
  }
  const name = escapePsSingleQuoted(String(pidOrId));
  return (
    `$p = Get-Process -Name '${name}' -ErrorAction Stop | Select-Object -First 1; ` +
    `$wshell = New-Object -ComObject WScript.Shell; ` +
    `$wshell.AppActivate($p.Id) | Out-Null`
  );
}

function buildQuitScript(pidOrId: string | number): string {
  if (typeof pidOrId === "number" || /^\d+$/.test(String(pidOrId))) {
    return `Stop-Process -Id ${Number(pidOrId)} -Force -ErrorAction Stop`;
  }
  const name = escapePsSingleQuoted(String(pidOrId));
  return `Stop-Process -Name '${name}' -Force -ErrorAction Stop`;
}
