/**
 * Darwin ClipboardService via pbpaste / pbcopy (ADR-0064).
 */
import { PlatformError } from "../errors.js";
import type { ClipboardService } from "../types.js";
import type { DarwinCommandRunner } from "./runner.js";

export function createDarwinClipboardService(
  runner: DarwinCommandRunner,
): ClipboardService {
  return {
    async readText(): Promise<string> {
      const result = await runner.run("pbpaste", []);
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "pbpaste failed",
        );
      }
      return result.stdout;
    },

    async writeText(text: string): Promise<void> {
      const result = await runner.run("pbcopy", [], { input: text });
      if (result.exitCode !== 0 && result.exitCode !== null) {
        throw new PlatformError(
          "io_error",
          result.stderr.trim() || "pbcopy failed",
        );
      }
    },
  };
}
