/**
 * Windows NotificationService via PowerShell balloon toast (ADR-0063).
 */
import { PlatformError } from "../errors.js";
import type { NotificationInput, NotificationService } from "../types.js";
import type { WindowsCommandRunner } from "./runner.js";

const PS = "powershell.exe";

function escapePsSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function createWindowsNotificationService(
  runner: WindowsCommandRunner,
): NotificationService {
  return {
    async show(input: NotificationInput): Promise<void> {
      const title = input.title?.trim();
      const body = input.body?.trim();
      if (!title) {
        throw new PlatformError(
          "invalid_input",
          "NotificationService.show requires a non-empty title",
        );
      }
      const t = escapePsSingleQuoted(title);
      const b = escapePsSingleQuoted(body ?? "");
      // Balloon tip via NotifyIcon — works without BurntToast module
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "Add-Type -AssemblyName System.Drawing",
        "$n = New-Object System.Windows.Forms.NotifyIcon",
        "$n.Icon = [System.Drawing.SystemIcons]::Information",
        "$n.Visible = $true",
        `$n.BalloonTipTitle = '${t}'`,
        `$n.BalloonTipText = '${b}'`,
        "$n.ShowBalloonTip(3000)",
        "Start-Sleep -Milliseconds 500",
        "$n.Dispose()",
      ].join("; ");

      const result = await runner.run(PS, [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
      ]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "Windows notification failed",
        );
      }
    },
  };
}
