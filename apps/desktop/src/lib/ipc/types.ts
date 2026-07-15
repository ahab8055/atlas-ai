/** Shared IPC types mirroring Rust `commands::system` payloads. */

export interface AppInfo {
  name: string;
  version: string;
  phase: string;
  runtime: string;
}

export interface PingResponse {
  ok: boolean;
  message: string;
}
