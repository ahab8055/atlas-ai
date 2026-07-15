# Atlas AI tests

| Path                          | Purpose                                      | Runner                          |
| ----------------------------- | -------------------------------------------- | ------------------------------- |
| `packages/*/src/**/*.test.ts` | Unit tests next to source                    | **Vitest**                      |
| `apps/*/src/**/*.test.ts(x)`  | App unit / component tests                   | **Vitest**                      |
| `tests/unit/`                 | Optional shared / cross-package unit helpers | **Vitest**                      |
| `tests/e2e/`                  | End-to-end desktop/web flows                 | **Playwright** (scaffold later) |
| `apps/desktop/src-tauri`      | Rust unit tests                              | **`cargo test`**                |

```bash
pnpm test           # Vitest once
pnpm test:watch     # Vitest watch
pnpm test:coverage  # Vitest + coverage
pnpm test:rust      # cargo test (desktop core)
```

See [docs/guides/Testing.md](../docs/guides/Testing.md).
