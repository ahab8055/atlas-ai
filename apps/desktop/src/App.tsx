import { useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await invoke<string>("greet", {
        name: name.trim() || "developer",
      });
      setMessage(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to reach Rust core",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-lg space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-sm tracking-[0.2em] text-cyan-400 uppercase">
            Atlas AI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Local-first assistant shell
          </h1>
          <p className="text-sm text-slate-400">
            Tauri + React + TypeScript frontend with Rust core. Invoke below
            verifies the IPC bridge.
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
          >
            {busy ? "Calling…" : "Greet Rust"}
          </button>
        </form>

        {message ? (
          <p className="rounded-md border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-cyan-100">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default App;
