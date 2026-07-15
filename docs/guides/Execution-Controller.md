# Atlas AI — Execution Controller

Centrally manages running approved plans: lifecycle, progress, and failures.

Related: [Task-Planning.md](./Task-Planning.md), [Request-Pipeline.md](./Request-Pipeline.md), [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md) (§7 Execution Controller), [ADR-0011](../adr/0011-execution-controller.md), [`@atlas-ai/core`](../../packages/core/).

---

## Lifecycle states

```
Pending → Running → Completed
                  → Failed
                  → Cancelled
```

| State       | Meaning                                                           |
| ----------- | ----------------------------------------------------------------- |
| `pending`   | Task created, not started                                         |
| `running`   | Steps executing                                                   |
| `completed` | All required steps succeeded                                      |
| `failed`    | Hard failure or blocked required step (automation did not finish) |
| `cancelled` | Cancelled before or during execution                              |

Outcome (`status`) keeps finer pipeline detail: `completed` | `partial` | `blocked` | `failed` | `cancelled`.

---

## Responsibilities

- Start execution (`execute` / `run`)
- Monitor progress (`onProgress`, `getTask`, `listTasks`)
- Capture failures (`failures[]` with `code` + `message`)
- Cancel between steps (`cancel` / `beforeStep → false`)

Flow (Architecture/22):

```
Plan Created → Permission Check → Execute Steps → Collect Results
```

---

## Progress

```ts
progress: {
  totalSteps, completedSteps, failedSteps, blockedSteps,
  skippedSteps, cancelledSteps, percent, currentStepId?
}
```

---

## Usage

```ts
import { ExecutionController, createPlan, handleRequest } from "@atlas-ai/core";

const executionController = new ExecutionController();

const result = handleRequest(
  { source: "cli", rawInput: "status" },
  { executionController },
);

console.log(result.execution.lifecycle, result.execution.progress);
console.log(result.execution.failures);

// Cancel a pending task:
const task = executionController.createTask(request, plan);
executionController.cancel(task.id);
```

---

## Package layout

`packages/core/src/execution/` — `ExecutionController`, tool stubs, types.

`pnpm test` includes `execution/controller.test.ts`.
