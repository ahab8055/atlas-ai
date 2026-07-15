import type { ReactNode } from "react";

const NAV_ITEMS = [
  { id: "assistant", label: "Assistant", hint: "Chat (soon)" },
  { id: "memory", label: "Memory", hint: "Context (soon)" },
  { id: "tools", label: "Tools", hint: "Actions (soon)" },
  { id: "settings", label: "Settings", hint: "Prefs (soon)" },
] as const;

interface ShellLayoutProps {
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Application shell layout with reserved slots for future Atlas modules.
 * Architecture/11: Conversation, Memory, Tools, Settings.
 */
export function ShellLayout({ children, footer }: ShellLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-slate-800 bg-slate-950/80 px-3 py-6 md:flex">
          <p className="px-2 text-xs tracking-[0.2em] text-cyan-400 uppercase">
            Atlas AI
          </p>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.id}
                className="rounded-md px-2 py-2 text-sm text-slate-400"
                title={item.hint}
              >
                <div className="font-medium text-slate-300">{item.label}</div>
                <div className="text-xs text-slate-600">{item.hint}</div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-auto">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}
