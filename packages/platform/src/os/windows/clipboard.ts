/**
 * Windows ClipboardService via PowerShell / clip.exe (ADR-0063).
 */
import { PlatformError } from "../errors.js";
import type { ClipboardService } from "../types.js";
import type { WindowsCommandRunner } from "./runner.js";

const PS = "powershell.exe";

export function createWindowsClipboardService(
  runner: WindowsCommandRunner,
): ClipboardService {
  return {
    async readText(): Promise<string> {
      const result = await runner.run(PS, [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Clipboard -Raw",
      ]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "Get-Clipboard failed",
        );
      }
      return result.stdout.replace(/\r?\n$/, "");
    },

    async writeText(text: string): Promise<void> {
      // Prefer clip.exe with stdin for reliability without escaping
      const result = await runner.run("clip.exe", [], { input: text });
      if (result.exitCode !== 0 && result.exitCode !== null) {
        // Fallback: Set-Clipboard
        const escaped = text.replace(/'/g, "''");
        const fallback = await runner.run(PS, [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Set-Clipboard -Value '${escaped}'`,
        ]);
        if (fallback.exitCode !== 0 && fallback.exitCode !== null) {
          throw new PlatformError(
            "io_error",
            fallback.stderr.trim() ||
              result.stderr.trim() ||
              "Clipboard write failed",
          );
        }
      }
    },
  };
}
