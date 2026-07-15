# Atlas AI — Error Handling

Central error classification, consistent response shape, logging, and recovery suggestions.

Related: [Logging.md](./Logging.md), [Response-Generation.md](./Response-Generation.md), [Request-Pipeline.md](./Request-Pipeline.md), [Execution-Controller.md](./Execution-Controller.md), [Architecture/22](../Architecture/22-AI-Orchestration-Architecture.md) (§ Failure Handling), [ADR-0020](../adr/0020-error-handling-framework.md), [`@atlas-ai/core`](../../packages/core/src/errors/).

---

## Categories

| Category | Label        | Typical codes                                       |
| -------- | ------------ | --------------------------------------------------- |
| `user`   | User Error   | `permission_blocked`, `cancelled`, `unknown_intent` |
| `tool`   | Tool Error   | `tool_failed`, `not_found`, `handler_error`         |
| `system` | System Error | `system_error`, `pipeline_error`                    |
| `ai`     | AI Error     | `model_failed`, `intent_failed`, `plan_failed`      |

Aligned with Architecture/22 failure types (permission → user, tools, model → ai, infra → system).

---

## Response format

```ts
interface AtlasErrorResponse {
  id: string;
  category: "user" | "tool" | "system" | "ai";
  code: string;
  message: string; // technical / logs
  userMessage: string; // understandable for people
  recoverable: boolean;
  recovery: RecoveryAction[]; // retry | ask_user | use_alternative | notify | …
  cause?: string;
  context?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
}
```

`PipelineResponse.structuredErrors` carries this list; `errors[]` stays as plain readable lines for CLI.

---

## Flow

```
throw / ExecutionFailure / unknown intent
        ↓
classify (category + code) → AtlasErrorResponse
        ↓
suggestRecovery (strategies; not auto-executed in MVP)
        ↓
ErrorHandler.log → @atlas-ai/logging (warn for user/tool, error for system/ai)
        ↓
ResponseGenerator / degraded pipeline result → userMessage + nextSteps
```

---

## Recovery (MVP)

Suggestions only — adapters / UI decide what to run:

| Strategy          | Example                              |
| ----------------- | ------------------------------------ |
| `ask_user`        | Approve permission, rephrase request |
| `retry`           | Retry tool / command                 |
| `use_alternative` | Try another tool                     |
| `notify`          | Check logs / status                  |
| `skip` / `none`   | Reserved                             |

`markRecoveryAttempted` exists for future auto-retry bookkeeping.

---

## Usage

```ts
import {
  createAtlasError,
  handleError,
  ErrorHandler,
  AtlasError,
} from "@atlas-ai/core";

const classified = createAtlasError({
  code: "tool_failed",
  message: "disk full",
  traceId,
});

const logged = handleError(err, { logger, traceId, category: "system" });
```

The request pipeline logs execution failures and unexpected throws via `ErrorHandler`, and returns a degraded `PipelineResult` (failed status + structured error) instead of crashing the CLI when a stage throws.

---

## Package layout

`packages/core/src/errors/` — types, classify, recovery, handler.
