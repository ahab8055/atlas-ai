# `@atlas-ai/logging`

Structured JSON logging for Atlas AI (local-first, monitoring-ready).

```ts
import { createLogger } from "@atlas-ai/logging";

const log = createLogger({ service: "desktop-ui", level: "debug" });
log.info("application started", { category: "application" });
log.logError("greet failed", err, { category: "application" });
```

See [docs/guides/Logging.md](../../docs/guides/Logging.md).
