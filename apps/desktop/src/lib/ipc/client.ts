import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, PingResponse } from "./types";

/**
 * Typed IPC client for the Atlas desktop shell.
 * Add new command wrappers here as Atlas modules grow.
 */
export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export async function ping(message?: string): Promise<PingResponse> {
  return invoke<PingResponse>("ping", { message });
}
