/**
 * Injectable Linux process runner (ADR-0065).
 */
import { spawn } from "node:child_process";

import { PlatformError } from "../errors.js";

export interface LinuxCommandRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  input?: string;
}

export interface LinuxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface LinuxCommandRunner {
  run(
    command: string,
    args: string[],
    options?: LinuxCommandRunOptions,
  ): Promise<LinuxCommandResult>;
}

export function createNodeLinuxCommandRunner(): LinuxCommandRunner {
  return {
    run(command, args, options = {}) {
      return new Promise((resolve, reject) => {
        if (!command.trim()) {
          reject(
            new PlatformError(
              "invalid_input",
              "Linux command must be non-empty",
            ),
          );
          return;
        }

        const child = spawn(command, args, {
          cwd: options.cwd,
          env: options.env ? { ...process.env, ...options.env } : process.env,
          shell: false,
        });

        let stdout = "";
        let stderr = "";
        let settled = false;

        const timer =
          options.timeoutMs !== undefined && options.timeoutMs > 0
            ? setTimeout(() => {
                if (!settled) {
                  settled = true;
                  child.kill();
                  reject(
                    new PlatformError(
                      "io_error",
                      `Linux command timed out after ${options.timeoutMs}ms: ${command}`,
                    ),
                  );
                }
              }, options.timeoutMs)
            : undefined;

        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => {
          stdout += chunk;
        });
        child.stderr?.on("data", (chunk: string) => {
          stderr += chunk;
        });

        child.on("error", (error) => {
          if (settled) {
            return;
          }
          settled = true;
          if (timer) {
            clearTimeout(timer);
          }
          reject(
            new PlatformError(
              "io_error",
              error instanceof Error ? error.message : String(error),
            ),
          );
        });

        child.on("close", (code) => {
          if (settled) {
            return;
          }
          settled = true;
          if (timer) {
            clearTimeout(timer);
          }
          resolve({
            stdout,
            stderr,
            exitCode: code,
          });
        });

        if (options.input !== undefined) {
          child.stdin?.write(options.input);
          child.stdin?.end();
        } else {
          child.stdin?.end();
        }
      });
    },
  };
}
