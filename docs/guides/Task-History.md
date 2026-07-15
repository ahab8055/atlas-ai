# Atlas AI — Task History

Track completed (and failed/blocked) actions so users can review previous activity.

Related: [Database.md](./Database.md), [Execution-Controller.md](./Execution-Controller.md), [CLI.md](./CLI.md), [Architecture/20](../Architecture/20-Database-Schema.md) (task executions), [ADR-0019](../adr/0019-task-history-tracking.md), [`@atlas-ai/database`](../../packages/database/).

---

## Purpose

- Store task execution history with **timestamps**
- Persist **results** and **failures**
- Query history for CLI / future Activity UI

---

## Data model (UI-ready)

`TaskHistoryEntry` is shaped for list + detail views:

| Field                        | Use                                               |
| ---------------------------- | ------------------------------------------------- |
| `title` / `display.headline` | Activity list title                               |
| `display.statusLabel`        | Badge text (`Completed`, `Failed`, …)             |
| `display.subtitle`           | Intent + timestamp line                           |
| `timestamps`                 | `createdAt`, `startedAt`, `finishedAt`            |
| `result`                     | Parsed result payload                             |
| `failures[]`                 | Structured failures (`message`, `code`, `stepId`) |
| `steps[]`                    | Expandable step results / errors                  |
| `display.hasFailures`        | Quick filter for error styling                    |

Storage tables: `execution_history` (+ `failures_json`) and `task_executions`.

---

## API

```ts
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase();

db.taskHistory.record({
  taskId: "…",
  goal: "Open VS Code",
  status: "completed",
  startedAt: "…",
  finishedAt: "…",
  result: { summary: "…" },
  failures: [],
  steps: [{ step: "open", status: "completed", result: "…" }],
});

const page = db.taskHistory.query({
  status: "completed",
  limit: 20,
  offset: 0,
});

const detail = db.taskHistory.getById(page.items[0]!.id);
```

Query filters: `status`, `intent`, `from` / `to` (ISO), `limit`, `offset`, `includeSteps`.

---

## CLI

Every normal command records history (when DB is enabled). Review with:

```bash
pnpm atlas history
pnpm atlas history --limit 5
pnpm atlas history --status blocked
pnpm atlas history --intent system.status
```

Also available in the REPL: type `history`.

---

## Package layout

- `packages/database/src/task-history.ts` — `TaskHistoryService` + UI DTOs
- `packages/database/src/repositories/execution-history.ts` — persistence + SQL query
- `apps/cli/src/history.ts` — terminal formatting
