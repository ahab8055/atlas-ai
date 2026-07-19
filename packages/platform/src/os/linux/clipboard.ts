/**
 * Linux ClipboardService via wl-copy/wl-paste, xclip, or xsel (ADR-0065).
 */
import { PlatformError } from "../errors.js";
import type { ClipboardService } from "../types.js";
import type { EnvService } from "../../types.js";
import type { LinuxCommandResult, LinuxCommandRunner } from "./runner.js";

type ClipboardBackend = "wayland" | "xclip" | "xsel";

function preferWayland(env: EnvService): boolean {
  const wayland = env.get("WAYLAND_DISPLAY");
  const session = env.get("XDG_SESSION_TYPE");
  return Boolean(wayland) || session?.toLowerCase() === "wayland";
}

function isCommandMissing(error: unknown): boolean {
  if (!(error instanceof PlatformError)) {
    return false;
  }
  if (error.detail?.errno === "ENOENT" || error.code === "resource_not_found") {
    return true;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes("enoent") ||
    msg.includes("not found") ||
    msg.includes("no such file")
  );
}

function failed(result: LinuxCommandResult): boolean {
  return result.exitCode !== 0 && result.exitCode !== null;
}

function backendOrder(env: EnvService): ClipboardBackend[] {
  return preferWayland(env)
    ? ["wayland", "xclip", "xsel"]
    : ["xclip", "xsel", "wayland"];
}

export interface CreateLinuxClipboardServiceOptions {
  runner: LinuxCommandRunner;
  env?: EnvService;
}

export function createLinuxClipboardService(
  runnerOrOptions: LinuxCommandRunner | CreateLinuxClipboardServiceOptions,
  maybeEnv?: EnvService,
): ClipboardService {
  const runner =
    "run" in runnerOrOptions ? runnerOrOptions : runnerOrOptions.runner;
  const env =
    "run" in runnerOrOptions ? maybeEnv : (runnerOrOptions.env ?? maybeEnv);

  const resolveEnv = (): EnvService =>
    env ?? {
      get: (key: string) => process.env[key],
      getOr: (key: string, fallback: string) => process.env[key] ?? fallback,
    };

  return {
    async readText(): Promise<string> {
      const order = backendOrder(resolveEnv());
      const errors: string[] = [];

      for (const backend of order) {
        try {
          if (backend === "wayland") {
            const result = await runner.run("wl-paste", ["--no-newline"]);
            if (!failed(result)) {
              return result.stdout;
            }
            errors.push(result.stderr.trim() || "wl-paste failed");
            continue;
          }
          if (backend === "xclip") {
            const result = await runner.run("xclip", [
              "-selection",
              "clipboard",
              "-o",
            ]);
            if (!failed(result)) {
              return result.stdout;
            }
            errors.push(result.stderr.trim() || "xclip read failed");
            continue;
          }
          const result = await runner.run("xsel", ["--clipboard", "--output"]);
          if (!failed(result)) {
            return result.stdout;
          }
          errors.push(result.stderr.trim() || "xsel read failed");
        } catch (error) {
          if (isCommandMissing(error)) {
            errors.push(`${backend} not available`);
            continue;
          }
          throw error;
        }
      }

      throw new PlatformError(
        "io_error",
        errors.filter(Boolean).join("; ") || "Clipboard read failed",
      );
    },

    async writeText(text: string): Promise<void> {
      const order = backendOrder(resolveEnv());
      const errors: string[] = [];

      for (const backend of order) {
        try {
          if (backend === "wayland") {
            const result = await runner.run("wl-copy", [], { input: text });
            if (!failed(result)) {
              return;
            }
            errors.push(result.stderr.trim() || "wl-copy failed");
            continue;
          }
          if (backend === "xclip") {
            const result = await runner.run(
              "xclip",
              ["-selection", "clipboard"],
              { input: text },
            );
            if (!failed(result)) {
              return;
            }
            errors.push(result.stderr.trim() || "xclip write failed");
            continue;
          }
          const result = await runner.run("xsel", ["--clipboard", "--input"], {
            input: text,
          });
          if (!failed(result)) {
            return;
          }
          errors.push(result.stderr.trim() || "xsel write failed");
        } catch (error) {
          if (isCommandMissing(error)) {
            errors.push(`${backend} not available`);
            continue;
          }
          throw error;
        }
      }

      throw new PlatformError(
        "io_error",
        errors.filter(Boolean).join("; ") || "Clipboard write failed",
      );
    },
  };
}
