# Atlas AI — Event System

Internal event bus foundation for modular component communication.

Related: [Architecture/10-Event-System-Architecture.md](../Architecture/10-Event-System-Architecture.md), [Architecture/22](../Architecture/22-AI-Orchestration-Architecture.md) (orchestration events), [Request-Pipeline.md](./Request-Pipeline.md), [ADR-0016](../adr/0016-event-system-integration.md), [`@atlas-ai/core`](../../packages/core/).

---

## Purpose

Components publish and subscribe through an **Event Bus** instead of calling each other directly (Architecture/10).

```
Component A  →  publish(event)  →  EventBus  →  subscribers (B, C, …)
```

---

## Event structure

Every event follows the Architecture/10 envelope:

| Field       | Type    | Description                                  |
| ----------- | ------- | -------------------------------------------- |
| `id`        | string  | Unique id (`evt_…`)                          |
| `type`      | string  | Event name (e.g. `IntentDetected`)           |
| `timestamp` | string  | ISO-8601 creation time                       |
| `source`    | string  | Publishing component (e.g. `atlas.pipeline`) |
| `traceId`   | string? | Request correlation id                       |
| `payload`   | object  | Type-specific data                           |

Example:

```json
{
  "id": "evt_3f2a…",
  "type": "PlanCreated",
  "timestamp": "2026-07-15T12:00:00.000Z",
  "source": "atlas.pipeline",
  "traceId": "trace-…",
  "payload": {
    "stage": "planning",
    "planId": "…",
    "goal": "Open VS Code",
    "kind": "simple",
    "stepCount": 1,
    "requiresApproval": true,
    "steps": []
  }
}
```

TypeScript: `AtlasEvent` / `CoreEventPayloadMap` in `@atlas-ai/core`.

---

## Core events (initial)

Orchestration events published by the request pipeline:

| Event                | When                                     |
| -------------------- | ---------------------------------------- |
| `RequestReceived`    | After normalization                      |
| `IntentDetected`     | After intent classification              |
| `ContextLoaded`      | After context assembly (Architecture/22) |
| `PlanCreated`        | After plan creation                      |
| `ExecutionStarted`   | Before plan execution                    |
| `ExecutionCompleted` | After plan execution                     |
| `ResponseGenerated`  | After response generation                |

Constant: `CORE_EVENTS` (alias `ORCHESTRATION_EVENTS`).

---

## Publish / subscribe

```ts
import { EventBus, handleRequest, CORE_EVENTS } from "@atlas-ai/core";

const bus = new EventBus();

// Subscribe
const stop = bus.subscribe("IntentDetected", (event) => {
  console.log(event.type, event.payload);
});

// Wildcard
bus.subscribe("*", (event) => {
  // all events
});

// Pipeline publishes core events
handleRequest({ source: "cli", rawInput: "status" }, { eventBus: bus });

stop();
```

Manual publish:

```ts
bus.publish({
  type: "CustomModuleReady",
  source: "my.component",
  payload: { ok: true },
});
```

Typed helper for core events: `publishCoreEvent(bus, "PlanCreated", payload, { traceId })`.

---

## MVP scope

| Piece              | Status                                 |
| ------------------ | -------------------------------------- |
| In-process bus     | Done (`EventBus`)                      |
| Core events        | Done (pipeline emits)                  |
| In-memory history  | Done (`getHistory`, limit default 200) |
| SQLite event store | Later (Architecture/17)                |
| Distributed bus    | Later (NATS/Kafka)                     |

---

## Package layout

`packages/core/src/events/` — types, bus, publish helpers.
