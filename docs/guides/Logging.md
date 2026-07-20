# Atlas AI — Logging

Structured, local-first logging for monitoring and debugging.

Related: [Architecture/15-Monitoring-Architecture.md](../Architecture/15-Monitoring-Architecture.md), [Platform-Abstraction.md](./Platform-Abstraction.md), [ADR-0004](../adr/0004-structured-logging.md), [ADR-0071](../adr/0071-platform-logging-diagnostics.md), [`@atlas-ai/logging`](../../packages/logging/), Rust `tracing` in `apps/desktop/src-tauri`.

---

## Goals

- Emit **structured** application events (JSON).
- Support **log levels** and **categories** from the monitoring architecture.
- Make **errors traceable** (`error.name`, `message`, `stack`).
- Stay **local-first** (console / future rotating files); no remote required for MVP.
- Prepare sinks for a future monitoring service.

---

## Log levels

| Level      | Use                                           |
| ---------- | --------------------------------------------- |
| `trace`    | Very detailed local debugging                 |
| `debug`    | Developer diagnostics                         |
| `info`     | Normal lifecycle / successful ops             |
| `warn`     | Recoverable / unexpected conditions           |
| `error`    | Failed operations                             |
| `critical` | System-level failures (monitoring “Critical”) |

Configured via:

- TypeScript: `createLogger({ level })` (often from `ATLAS_LOG_LEVEL` / `@atlas-ai/config`)
- Rust: `RUST_LOG` / `tracing` EnvFilter (default `info,atlas_desktop=debug`)

---

## Categories

From Monitoring Architecture:

`application` | `ai` | `tool` | `security` | `workflow`

---

## Record shape (TypeScript)

```json
{
  "timestamp": "2026-07-15T12:00:00.000Z",
  "service": "desktop-ui",
  "category": "application",
  "level": "error",
  "message": "greet failed",
  "context": { "name": "developer" },
  "error": {
    "name": "Error",
    "message": "...",
    "stack": "..."
  },
  "traceId": "optional-future-correlation-id"
}
```

Sensitive keys in `context` (e.g. `apiKey`, `password`, `token`) are **redacted**.

---

## TypeScript usage

```ts
import { createLogger } from "@atlas-ai/logging";

const log = createLogger({ service: "my-service", level: "info" });

log.info("started", { category: "application" });
log.logError("operation failed", err, {
  category: "tool",
  context: { tool: "file.read" },
});

// Hosts inject child loggers into packages, e.g. platform diagnostics (ADR-0071):
// logger.child("platform") → service "atlas-cli.platform"
```

Sinks:

- **Console** (default) — JSON lines to stdout/browser console
- **File** (`@atlas-ai/logging/node` → `createFileSink`) — JSONL under a local path (Node only); for future rotating logs in `.data/logs/`
- **Multi** (`createMultiSink`) — fan-out for future monitoring adapters

---

## Rust usage (desktop core)

Tech stack recommendation: **`tracing`** + **`tracing-subscriber`** (JSON).

```bash
RUST_LOG=debug pnpm dev
```

Startup and `greet` emit structured events. Failures use `error!(...)`.

---

## Privacy & security

- Logs remain **local by default** (Monitoring Architecture).
- Never log secrets, raw API keys, or full user content when avoidable.
- Prefer redaction helpers; treat security events with `category: "security"`.

---

## Future monitoring

The JSON record + category/level fields are the ingest contract for:

- Local diagnostic export
- Health / monitoring service (Architecture/15)
- Optional later Sentry (Technology Stack — post-MVP free tier)

Related local diagnostics today:

- AI runtime: [Runtime-Monitoring.md](./Runtime-Monitoring.md)
- Long-term memory store/process stats: [Memory-Analytics.md](./Memory-Analytics.md)

---

## Commands

```bash
pnpm --filter @atlas-ai/logging build
pnpm check:rust   # verifies tracing wiring in desktop core
```
