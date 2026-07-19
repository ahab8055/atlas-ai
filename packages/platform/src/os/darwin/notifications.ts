/**
 * Darwin NotificationService via osascript display notification (ADR-0064).
 */
import { PlatformError } from "../errors.js";
import type { NotificationInput, NotificationService } from "../types.js";
import type { DarwinCommandRunner } from "./runner.js";

function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function createDarwinNotificationService(
  runner: DarwinCommandRunner,
): NotificationService {
  return {
    async show(input: NotificationInput): Promise<void> {
      const title = input.title?.trim();
      if (!title) {
        throw new PlatformError(
          "invalid_input",
          "NotificationService.show requires a non-empty title",
        );
      }
      const t = escapeAppleScript(title);
      const b = escapeAppleScript(input.body ?? "");
      const script = `display notification "${b}" with title "${t}"`;
      const result = await runner.run("osascript", ["-e", script]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "macOS notification failed",
        );
      }
    },
  };
}
