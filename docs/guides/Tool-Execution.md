# Atlas AI — Tool Execution

Safe execution engine for registered tools: validate → (permission) → run → capture.

Related: [Tool-Registry.md](./Tool-Registry.md), [Execution-Controller.md](./Execution-Controller.md), [Architecture/05-Tool-System-Architecture.md](../Architecture/05-Tool-System-Architecture.md), [ADR-0013](../adr/0013-tool-execution-framework.md), [`@atlas-ai/tools`](../../packages/tools/).

---

## Flow

```
Tool Request
      ↓
Validate Input          (inputSchema)
      ↓
Check Permission        (optional — ExecutionController usually gates first)
      ↓
Execute Handler
      ↓
Validate Output         (outputSchema when data present)
      ↓
Capture Result          (status, timing, errors)
      ↓
Return to Atlas Core
```

---

## API

```ts
import { executeTool, ToolExecutor } from "@atlas-ai/tools";

const result = executeTool({
  name: "echo",
  input: { text: "hello" },
  context: { requestId: "…", source: "cli" },
  // checkPermissions: true  // for direct calls outside the plan controller
});

if (result.ok) {
  console.log(result.message, result.data, result.durationMs);
} else {
  console.error(result.status, result.errorCode, result.error);
}
```

### Result fields

| Field                 | Meaning                             |
| --------------------- | ----------------------------------- |
| `ok` / `status`       | Success or failure class            |
| `message` / `data`    | Handler output for core             |
| `error` / `errorCode` | Failure details                     |
| `validationErrors`    | Schema issues                       |
| `durationMs`          | Execution timing                    |
| `permission`          | Present when permission check fails |

Statuses: `completed` · `failed` · `invalid_input` · `not_found` · `permission_denied`

---

## Core wiring

`@atlas-ai/core` `executeToolStep` calls `executeTool` / `ToolExecutor`, then maps to plan `StepResult`. Failures become step `failed` and are reported by the ExecutionController.

---

## Commands

```bash
pnpm tools:build
pnpm test
```
