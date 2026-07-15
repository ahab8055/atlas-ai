/**
 * Optional managed `llama-server` process (CPU by default via -ngl 0).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import type { HardwareProfile } from "../hardware.js";
import { resolveGpuLayers } from "../hardware.js";
import { AiRuntimeError } from "../errors.js";

export interface LlamaServerLaunchOptions {
  binary: string;
  modelPath: string;
  host: string;
  port: number;
  hardware: HardwareProfile;
  /** Extra CLI args appended after defaults. */
  extraArgs?: string[];
}

export function buildLlamaServerArgs(
  options: LlamaServerLaunchOptions,
): string[] {
  const gpuLayers = resolveGpuLayers(options.hardware);
  const args = [
    "-m",
    options.modelPath,
    "--host",
    options.host,
    "--port",
    String(options.port),
    "-c",
    String(options.hardware.contextSize),
    "-ngl",
    String(gpuLayers),
  ];
  if (options.hardware.threads && options.hardware.threads > 0) {
    args.push("-t", String(options.hardware.threads));
  }
  if (options.extraArgs?.length) {
    args.push(...options.extraArgs);
  }
  return args;
}

export class LlamaServerProcess {
  private child: ChildProcess | undefined;

  get running(): boolean {
    return this.child !== undefined && this.child.exitCode === null;
  }

  async start(
    options: LlamaServerLaunchOptions,
    waitUntilHealthy: () => Promise<boolean>,
  ): Promise<void> {
    await this.stop();

    const args = buildLlamaServerArgs(options);
    this.child = spawn(options.binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";
    this.child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });

    this.child.on("exit", () => {
      this.child = undefined;
    });

    const ready = await waitFor(
      async () => {
        if (
          this.child?.exitCode !== null &&
          this.child?.exitCode !== undefined
        ) {
          return false;
        }
        return waitUntilHealthy();
      },
      { attempts: 60, delayMs: 500 },
    );

    if (!ready) {
      await this.stop();
      throw new AiRuntimeError(
        `llama-server failed to become healthy${stderr ? `: ${stderr.trim()}` : ""}`,
        { code: "server_start_failed", provider: "llamacpp" },
      );
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) {
      return;
    }
    this.child = undefined;
    if (child.exitCode !== null) {
      return;
    }
    child.kill("SIGTERM");
    await delay(300);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }
}

async function waitFor(
  probe: () => Promise<boolean>,
  options: { attempts: number; delayMs: number },
): Promise<boolean> {
  for (let i = 0; i < options.attempts; i += 1) {
    try {
      if (await probe()) {
        return true;
      }
    } catch {
      // retry
    }
    await delay(options.delayMs);
  }
  return false;
}

export function parseEndpoint(baseUrl: string): { host: string; port: number } {
  try {
    const url = new URL(baseUrl);
    const port = url.port
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80;
    return { host: url.hostname || "127.0.0.1", port };
  } catch {
    return { host: "127.0.0.1", port: 8080 };
  }
}
