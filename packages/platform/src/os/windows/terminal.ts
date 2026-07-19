/**
 * Windows TerminalService — direct process spawn via runner (ADR-0063).
 */
import { PlatformError } from "../errors.js";
import type {
  TerminalExecuteOptions,
  TerminalExecuteResult,
  TerminalService,
} from "../types.js";
import type { WindowsCommandRunner } from "./runner.js";

export function createWindowsTerminalService(
  runner: WindowsCommandRunner,
): TerminalService {
  return {
    async execute(
      command: string,
      args: string[] = [],
      options: TerminalExecuteOptions = {},
    ): Promise<TerminalExecuteResult> {
      const cmd = command.trim();
      if (!cmd) {
        throw new PlatformError(
          "invalid_input",
          "TerminalService.execute requires a non-empty command",
        );
      }
      return runner.run(cmd, args, {
        cwd: options.cwd,
        env: options.env,
        timeoutMs: options.timeoutMs,
      });
    },
  };
}
