# Atlas AI CLI

Thin terminal adapter into `@atlas-ai/core`. Commands go through the same request pipeline desktop and voice will use later (`source: "cli"`).

```bash
pnpm atlas help
pnpm atlas status
pnpm atlas echo hello
pnpm atlas --debug "Open VS Code"
pnpm atlas -i
```

- **stdout** — Atlas response (`response.text`)
- **stderr** — stage logs / debug events (debug mode)

See [docs/guides/CLI.md](../../docs/guides/CLI.md) and [ADR-0017](../../docs/adr/0017-command-line-interface.md).
