# Atlas AI — Request Processing Pipeline

Central orchestration path for user commands (Phase 1 Core Runtime).

Related: [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md), [`@atlas-ai/core`](../../packages/core/), [`@atlas-ai/cli`](../../apps/cli/), [ADR-0007](../adr/0007-request-processing-pipeline.md), [Intent-Detection.md](./Intent-Detection.md), [Context-Management.md](./Context-Management.md), [Task-Planning.md](./Task-Planning.md), [Execution-Controller.md](./Execution-Controller.md), [Logging.md](./Logging.md), [Security.md](./Security.md).

---

## Flow

```
User Input (CLI | desktop | voice | api)
        ↓
Request Handler          (@atlas-ai/core)
        ↓
Normalize request
        ↓
Intent Detection
        ↓
Context Loading
        ↓
Planning
        ↓
Tool Execution           (+ security evaluatePermission)
        ↓
Response Generation
```

Orchestration events (logged with `traceId`):

`RequestReceived` → `IntentDetected` → `ContextLoaded` → `PlanCreated` →
`ExecutionStarted` → `ExecutionCompleted` → `ResponseGenerated`

---

## Packages

| Package              | Role                                                       |
| -------------------- | ---------------------------------------------------------- |
| `@atlas-ai/core`     | Pipeline stages + `handleRequest` / `createRequestHandler` |
| `@atlas-ai/cli`      | First input adapter (`source: "cli"`)                      |
| `@atlas-ai/logging`  | Structured stage logs                                      |
| `@atlas-ai/security` | Permission checks during execution                         |

Desktop and voice reuse the same handler with `source: "desktop"` or `"voice"` — no pipeline fork.

---

## CLI usage

```bash
pnpm core:build && pnpm cli:build
pnpm atlas help
pnpm atlas status
pnpm atlas echo hello world
```

Quiet mode (response only):

```bash
ATLAS_CLI_QUIET=1 pnpm atlas status
```

---

## Extending inputs

```ts
import { handleRequest } from "@atlas-ai/core";

const result = handleRequest({
  source: "desktop", // or "voice" | "api"
  rawInput: userText,
  sessionId: "session-1",
});

console.log(result.response.text);
```

---

## MVP vs later

| Stage    | MVP                                | Later                            |
| -------- | ---------------------------------- | -------------------------------- |
| Intent   | Registry heuristics + params       | Model / Request Analyzer         |
| Context  | Provider assembly + conversation   | Memory + KG (`@atlas-ai/memory`) |
| Plan     | Template registry (simple + multi) | Agent / LLM planner              |
| Execute  | ExecutionController + tool stubs   | `@atlas-ai/tools` registry       |
| Response | Template text                      | LLM generation                   |

---

## Commands

```bash
pnpm core:build
pnpm cli:build
pnpm atlas -- help
pnpm test   # includes packages/core pipeline tests
```
