# `@atlas-ai/tools`

Central tool registry for Atlas: registration, metadata, discovery, versioning.

```ts
import {
  listToolMetadata,
  registerTool,
  getDefaultToolRegistry,
} from "@atlas-ai/tools";

console.log(listToolMetadata().map((t) => t.name));
```

See [docs/guides/Tool-Registry.md](../../docs/guides/Tool-Registry.md) and
[docs/guides/Tool-Execution.md](../../docs/guides/Tool-Execution.md).
