# Atlas AI — Model Router

Automatic model selection per task (Architecture/25 Model Router).

Related: [Hardware-Profiles.md](./Hardware-Profiles.md), [Model-Compatibility.md](./Model-Compatibility.md), [Model-Registry.md](./Model-Registry.md), [Local-AI-Runtime.md](./Local-AI-Runtime.md), [ADR-0030](../adr/0030-model-router.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- **Analyze task complexity** (simple / moderate / complex) and task type (conversation, coding, reasoning).
- **Consider hardware** via detected resource profile and suitability scoring.
- **Match model capabilities** (chat, coding, reasoning) and size class.
- **Explain routing decisions** with human-readable reasons.
- Support **manual model selection** (`--model` / `load` / config default).

---

## CLI

```bash
# Explain automatic selection for a prompt
pnpm atlas ai route "Summarize this note"

# Manual override (explain only)
pnpm atlas ai route --model general/phi-3 "hello"

# ask auto-routes when registry models exist
pnpm atlas ai ask "Implement a REST API in Rust"

# Manual load still bypasses router
pnpm atlas ai load coding/coder
```

Set `ATLAS_CLI_DEBUG=1` to print routing details on `ask`.

---

## API

```ts
import {
  analyzeTask,
  routeModel,
  formatRoutingDecision,
  createAiRuntime,
} from "@atlas-ai/ai";

const task = analyzeTask({ prompt: "Review my backend architecture" });
// task.taskType, task.complexity, task.summary

const decision = routeModel({
  prompt: "hello",
  models: registry.list(),
  fallbackModelId: "general/tiny",
});
console.log(formatRoutingDecision(decision));
// decision.modelId, decision.reasons, decision.alternatives
```

### Runtime integration

```ts
const runtime = createAiRuntime({
  defaultModelId: "general/tiny",
  router: {
    enabled: true,
    listModels: () => registry.list(),
    fallbackModelId: "general/tiny",
  },
});

const routed = runtime.route({ prompt: "debug this function" });
await runtime.generate({
  messages: [{ role: "user", content: "debug this function" }],
});
// generate auto-selects when modelId omitted and router is configured
```

Manual selection: pass `preferredModelId` to `routeModel` or `modelId` on `generate` / `loadModel`.

---

## Routing pipeline

1. **Task analysis** — heuristics on prompt length and keywords.
2. **Target size class** — e.g. simple chat → small; complex reasoning → large.
3. **Hardware profile** — from `detectHardware()`.
4. **Rank catalog** — `recommendModelsForProfile` + capability boosts.
5. **Decision** — top score with reasons and alternatives.

---

## Out of scope

Cloud model routing, live VRAM budgeting, fine-tuned per-user preference learning.
