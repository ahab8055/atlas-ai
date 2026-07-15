# Atlas AI CLI

Thin input adapter that feeds commands into `@atlas-ai/core`.

```bash
pnpm atlas help
pnpm atlas status
pnpm atlas echo hello
```

Logs pipeline stages to stderr/stdout via `@atlas-ai/logging` (JSON). Set `ATLAS_CLI_QUIET=1` to hide info logs and only print the response.

See [Request-Pipeline.md](../../docs/guides/Request-Pipeline.md).
