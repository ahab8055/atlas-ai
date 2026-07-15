# `@atlas-ai/core`

Central request processing pipeline for Atlas AI.

```
Incoming request → normalize → intent → context → plan → execute → respond
```

Intent detection lives under `src/intent/` (registry + builtins). See
[Intent-Detection.md](../../docs/guides/Intent-Detection.md).

Input adapters (CLI, desktop, voice) stay outside this package and call `handleRequest`.

See [docs/guides/Request-Pipeline.md](../../docs/guides/Request-Pipeline.md).
