# `@atlas-ai/core`

Central request processing pipeline for Atlas AI.

```
Incoming request → normalize → intent → context → plan → execute → respond
```

- Intent: `src/intent/` — [Intent-Detection.md](../../docs/guides/Intent-Detection.md)
- Context: `src/context/` — [Context-Management.md](../../docs/guides/Context-Management.md)
- Planning: `src/planning/` — [Task-Planning.md](../../docs/guides/Task-Planning.md)
- Execution: `src/execution/` — [Execution-Controller.md](../../docs/guides/Execution-Controller.md)
- Response: `src/response/` — [Response-Generation.md](../../docs/guides/Response-Generation.md)
- Tools: `@atlas-ai/tools` — [Tool-Registry.md](../../docs/guides/Tool-Registry.md)

Input adapters (CLI, desktop, voice) stay outside this package and call `handleRequest`.

See [docs/guides/Request-Pipeline.md](../../docs/guides/Request-Pipeline.md).
