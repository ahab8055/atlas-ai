# Atlas AI — Task Planning

Builds structured, ordered execution plans before the tool system runs.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md) (Planning Engine), [ADR-0010](../adr/0010-task-planning-engine.md), [`@atlas-ai/core`](../../packages/core/).

---

## When it runs

```
Context Loading
      ↓
Planning   ← createPlan(request, intent, context)
      ↓
Tool Execution (ordered steps)
```

---

## Plan shape (`ExecutionPlan`)

| Field              | Meaning                                         |
| ------------------ | ----------------------------------------------- |
| `id`               | Traceable plan id                               |
| `goal`             | User-facing outcome                             |
| `kind`             | `simple` (1 step) or `multi` (2+ ordered steps) |
| `intentName`       | Source intent                                   |
| `steps[]`          | Ordered tool-ready steps                        |
| `requiresApproval` | True when any step needs elevated capability    |

Each `PlanStep`:

| Field         | Meaning                                                 |
| ------------- | ------------------------------------------------------- |
| `order`       | 1-based sequence                                        |
| `id`          | Stable step id                                          |
| `description` | Human label                                             |
| `tool`        | Tool system id (`application.open`, `process.start`, …) |
| `args`        | Tool arguments                                          |
| `capability`  | Security capability gate                                |
| `optional`    | If true, failure does not skip later steps              |

---

## Examples

### Simple

`Open VS Code` → one step: `application.open` with `application=VS Code`.

### Multi-step

`Prepare my development environment` →

1. Open VS Code (`application.open`)
2. Open project (`project.open`)
3. Start backend (`process.start`)
4. Start frontend (`process.start`)

Uses context preferences (`preferredEditor`) and project name when present.

---

## Extending

```ts
import { draftStep, registerPlanTemplate } from "@atlas-ai/core";

registerPlanTemplate({
  intentName: "workflow.deploy",
  priority: 80,
  build({ intent }) {
    return {
      goal: intent.goal,
      requiresApproval: true,
      steps: [
        draftStep("build", "Build app", {
          tool: "process.start",
          capability: "terminal.execute",
          args: { name: "build", command: "pnpm build" },
        }),
        draftStep("deploy", "Deploy app", {
          tool: "process.start",
          capability: "terminal.execute",
          args: { name: "deploy", command: "pnpm deploy" },
        }),
      ],
    };
  },
});
```

---

## Tool system handoff

`executePlan` walks steps in `order`, checks capabilities, then invokes tool stubs (later `@atlas-ai/tools`). Required steps that block/fail cause later steps to be `skipped`.

```bash
pnpm atlas "Prepare my development environment"
pnpm atlas "Open VS Code"
```
