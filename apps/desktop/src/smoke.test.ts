import { describe, expect, it } from "vitest";
import type { AppInfo, PingResponse } from "./lib/ipc/types";

describe("desktop IPC types", () => {
  it("describes foundation app info shape", () => {
    const info: AppInfo = {
      name: "Atlas AI",
      version: "0.1.0",
      phase: "foundation",
      runtime: "tauri",
    };
    expect(info.phase).toBe("foundation");
  });

  it("describes ping response shape", () => {
    const ping: PingResponse = { ok: true, message: "pong" };
    expect(ping.ok).toBe(true);
  });
});
