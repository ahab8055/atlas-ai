import type { AppInfo } from "../../lib/ipc";
import type { FrontendLifecycle } from "../../hooks/useAppLifecycle";

interface ShellHomeProps {
  phase: FrontendLifecycle;
  appInfo: AppInfo | null;
  error: string | null;
}

export function ShellHome({ phase, appInfo, error }: ShellHomeProps) {
  return (
    <main className="flex h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <header className="space-y-3">
          <p className="text-sm tracking-[0.2em] text-cyan-400 uppercase md:hidden">
            Atlas AI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Desktop foundation
          </h1>
          <p className="text-sm text-slate-400">
            Native shell with Tauri IPC. Future assistant modules plug into this
            layout.
          </p>
        </header>

        {phase === "ready" && appInfo ? (
          <dl className="grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
              <dt className="text-slate-500">Runtime</dt>
              <dd className="text-slate-100">{appInfo.runtime}</dd>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
              <dt className="text-slate-500">Phase</dt>
              <dd className="text-slate-100">{appInfo.phase}</dd>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
              <dt className="text-slate-500">Version</dt>
              <dd className="text-slate-100">{appInfo.version}</dd>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
              <dt className="text-slate-500">IPC</dt>
              <dd className="text-emerald-400">Connected</dd>
            </div>
          </dl>
        ) : null}

        {phase === "connecting" || phase === "mounting" ? (
          <p className="text-sm text-amber-200/90">
            Handshaking with Rust core…
          </p>
        ) : null}

        {phase === "error" && error ? (
          <p className="rounded-md border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
            <span className="mt-2 block text-rose-300/80">
              Run the full desktop app with `pnpm dev` (Tauri), not web-only
              mode.
            </span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
