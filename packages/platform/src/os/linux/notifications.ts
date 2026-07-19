/**
 * Linux NotificationService via notify-send (ADR-0065).
 */
import { PlatformError } from "../errors.js";
import type { NotificationInput, NotificationService } from "../types.js";
import type { LinuxCommandRunner } from "./runner.js";

export function createLinuxNotificationService(
  runner: LinuxCommandRunner,
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
      const body = input.body ?? "";
      const result = await runner.run("notify-send", [title, body]);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "notify-send failed",
        );
      }
    },
  };
}
