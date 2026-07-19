/**
 * Injectable Darwin process runner (ADR-0064).
 */
import { spawn } from "node:child_process";

import { PlatformError } from "../errors.js";
import { translateNativeError } from "../translate-error.js";

export interface DarwinCommandRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  input?: string;
}

export interface DarwinCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface DarwinCommandRunner {
  run(
    command: string,
    args: string[],
    options?: DarwinCommandRunOptions,
  ): Promise<DarwinCommandResult>;
}

export function createNodeDarwinCommandRunner(): DarwinCommandRunner {
  return {
    run(command, args, options = {}) {
      return new Promise((resolve, reject) => {
        if (!command.trim()) {
          reject(
            new PlatformError(
              "invalid_input",
              "Darwin command must be non-empty",
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
                      `Darwin command timed out after ${options.timeoutMs}ms: ${command}`,
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
            translateNativeError(error, {
              operation: `Darwin command: ${command}`,
              platform: "darwin",
            }),
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
