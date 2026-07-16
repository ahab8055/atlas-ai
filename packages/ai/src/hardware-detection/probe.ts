/**
 * Injectable OS / shell probe so hardware detection is testable offline.
 */
import { spawnSync } from "node:child_process";
import os from "node:os";

export interface CommandResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

export interface SystemProbe {
  platform(): NodeJS.Platform;
  arch(): string;
  cpus(): os.CpuInfo[];
  totalmem(): number;
  freemem(): number;
  release(): string;
  type(): string;
  version(): string;
  runCommand(
    command: string,
    args: string[],
    timeoutMs: number,
  ): CommandResult | null;
}

export function createNodeSystemProbe(): SystemProbe {
  return {
    platform: () => os.platform(),
    arch: () => os.arch(),
    cpus: () => os.cpus(),
    totalmem: () => os.totalmem(),
    freemem: () => os.freemem(),
    release: () => os.release(),
    type: () => os.type(),
    version: () => {
      try {
        return os.version();
      } catch {
        return os.release();
      }
    },
    runCommand(command, args, timeoutMs) {
      try {
        const result = spawnSync(command, args, {
          encoding: "utf8",
          timeout: timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        });
        if (result.error) {
          return null;
        }
        return {
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
          status: result.status,
        };
      } catch {
        return null;
      }
    },
  };
}
