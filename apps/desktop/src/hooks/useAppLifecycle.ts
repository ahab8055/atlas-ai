import { useEffect, useState } from "react";
import { createLogger } from "@atlas-ai/logging";
import { getAppInfo, ping } from "../lib/ipc";
import type { AppInfo } from "../lib/ipc";

const log = createLogger({
  service: "desktop-ui",
  level: "debug",
  category: "application",
});

export type FrontendLifecycle = "mounting" | "connecting" | "ready" | "error";

export interface AppLifecycleState {
  phase: FrontendLifecycle;
  appInfo: AppInfo | null;
  bridgeOk: boolean;
  error: string | null;
}

/**
 * Frontend lifecycle: mount → IPC handshake → ready.
 * Mirrors Rust Initialize → Ready → Running for the UI side.
 */
export function useAppLifecycle(): AppLifecycleState {
  const [phase, setPhase] = useState<FrontendLifecycle>("mounting");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [bridgeOk, setBridgeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setPhase("connecting");
      log.info("desktop UI lifecycle: connecting to Rust core");

      try {
        const [info, pong] = await Promise.all([
          getAppInfo(),
          ping("atlas-shell"),
        ]);

        if (cancelled) {
          return;
        }

        setAppInfo(info);
        setBridgeOk(pong.ok);
        setPhase("ready");
        log.info("desktop UI lifecycle: ready", {
          context: {
            version: info.version,
            phase: info.phase,
            ping: pong.message,
          },
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        const message =
          err instanceof Error ? err.message : "IPC handshake failed";
        setError(message);
        setBridgeOk(false);
        setPhase("error");
        log.logError("desktop UI lifecycle: error", err);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      log.debug("desktop UI lifecycle: unmount");
    };
  }, []);

  return { phase, appInfo, bridgeOk, error };
}
