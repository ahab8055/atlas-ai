# Atlas AI — Response Generation

Converts execution results into clear user-facing messages after the pipeline runs a task.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [Execution-Controller.md](./Execution-Controller.md), [Error-Handling.md](./Error-Handling.md), [Architecture/22](../Architecture/22-AI-Orchestration-Architecture.md) (§8 Response Generator), [Architecture/08](../Architecture/08-Voice-System-Architecture.md) (TTS later), [ADR-0015](../adr/0015-response-generation-system.md), [`@atlas-ai/core`](../../packages/core/).

---

## Purpose

After plan execution, Atlas should explain:

- What happened (summary + step outputs)
- Task status (completed / blocked / failed / …)
- Errors and warnings in plain language
- Sensible next steps

---

## Response shape

```ts
interface PipelineResponse {
  text: string; // CLI / desktop / logs
  spokenText: string; // voice-ready for future TTS
  summary: string; // one-line headline
  intent: string;
  status: ExecutionStatus;
  lifecycle?: ExecutionLifecycleState;
  errors: string[];
  structuredErrors: AtlasErrorResponse[]; // category, code, recovery
  warnings: string[];
  nextSteps: string[];
  modality: "text" | "voice" | "both";
}
```

| Field              | Use                                                           |
| ------------------ | ------------------------------------------------------------- |
| `text`             | Full formatted message (status, body, errors, warnings)       |
| `spokenText`       | Concise speakable form — adapters feed TTS later              |
| `status`           | Task outcome (`completed`, `blocked`, `failed`, …)            |
| `errors`           | Explained failures (permission, tool, cancel, …)              |
| `structuredErrors` | Category / code / recovery for UI and logs                    |
| `warnings`         | Non-fatal issues (skipped steps, partial completion)          |
| `nextSteps`        | What the user can do next (often from recovery suggestions)   |
| `modality`         | Hint from input source (`voice` → prefer spoken presentation) |

---

## Flow

```
ExecutionResult (+ intent, plan, request)
        ↓
ResponseGenerator.generate(...)
        ↓
special intents (help / tools / unknown)
   or status-based templates (completed / failed / blocked / …)
        ↓
PipelineResponse  →  CLI stdout / desktop UI / future TTS
```

Pipeline stage: `stages/respond.ts` → `packages/core/src/response/`.

---

## Voice readiness

Architecture/08 TTS is not wired yet. Foundation:

1. Always populate `spokenText` (no heavy tables).
2. Set `modality: "voice"` when `request.source === "voice"`.
3. Voice adapters can later call TTS with `spokenText` only.

---

## Usage

```ts
import { generateResponse, ResponseGenerator } from "@atlas-ai/core";

const response = generateResponse(request, intent, execution, plan);
console.log(response.text);
console.log(response.status, response.errors);

// Voice adapter (future):
// speak(response.spokenText);
```

---

## Package layout

`packages/core/src/response/` — generator, builders, error explanations, intent copy, types.
