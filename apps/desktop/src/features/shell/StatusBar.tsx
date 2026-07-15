import type { AppInfo } from "../../lib/ipc";
import type { FrontendLifecycle } from "../../hooks/useAppLifecycle";

interface StatusBarProps {
  phase: FrontendLifecycle;
  bridgeOk: boolean;
  appInfo: AppInfo | null;
}

function phaseLabel(phase: FrontendLifecycle, bridgeOk: boolean): string {
  if (phase === "ready" && bridgeOk) {
    return "Core connected";
  }
  if (phase === "error") {
    return "Core unreachable";
  }
  if (phase === "connecting") {
    return "Connecting…";
  }
  return "Starting…";
}

export function StatusBar({ phase, bridgeOk, appInfo }: StatusBarProps) {
  const ok = phase === "ready" && bridgeOk;

  return (
    <footer className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-400">
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : phase === "error" ? "bg-rose-400" : "bg-amber-400"}`}
          aria-hidden
        />
        {phaseLabel(phase, bridgeOk)}
      </span>
      <span>
        {appInfo
          ? `${appInfo.name} ${appInfo.version} · ${appInfo.phase}`
          : "Atlas AI"}
      </span>
    </footer>
  );
}
