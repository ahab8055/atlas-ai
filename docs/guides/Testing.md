# Atlas AI — Testing

How to write and run tests during Foundation Setup and beyond.

Related: [Technology-Stack-Architecture.md](../product/Technology-Stack-Architecture.md) (Vitest + Playwright), [Code-Quality-Standards.md](./Code-Quality-Standards.md).

---

## Stack

| Layer                         | Tool                                                   |
| ----------------------------- | ------------------------------------------------------ |
| TypeScript unit / integration | **Vitest**                                             |
| React component tests (later) | Vitest + Testing Library                               |
| End-to-end                    | **Playwright** (directory reserved under `tests/e2e/`) |
| Rust                          | Built-in `cargo test`                                  |

CI (GitHub Actions) runs the same unit commands on every pull request — see [CI-CD.md](./CI-CD.md).

---

## Directory structure

```
atlas-ai/
├── vitest.config.ts
├── packages/
│   └── */src/**/*.test.ts     # unit tests next to source
├── apps/
│   └── */src/**/*.test.ts(x)  # app unit / smoke tests
├── tests/
│   ├── README.md
│   ├── unit/                  # optional shared unit helpers
│   ├── integration/           # cross-package Phase 1 core runtime
│   └── e2e/                   # Playwright (later)
└── apps/desktop/src-tauri/    # #[cfg(test)] modules
```

Rules:

- Prefer **colocated** `*.test.ts` beside implementation.
- Use `tests/integration/` for **cross-package** Phase 1 workflows (pipeline ↔ tools ↔ security).
- Use `tests/e2e/` only for cross-cutting UI flows.
- Do not commit secrets or live `.env` values into fixtures; use inline `envVars` like config tests.

---

## Commands

```bash
pnpm test               # Build workspace packages, then Vitest once (unit + integration)
pnpm test:integration   # Build packages, then Vitest tests/integration only
pnpm test:watch         # Vitest watch (build packages first if dist/ missing)
pnpm test:coverage      # Build packages + Vitest + V8 coverage → coverage/
pnpm test:rust          # cargo test for atlas-desktop
pnpm test:all           # Vitest + Rust
pnpm packages:build     # config, logging, security, tools, database, core
```

Workspace packages export `dist/`. `pnpm test` builds them first so CI and fresh clones resolve `@atlas-ai/logging` / `@atlas-ai/security` correctly.

---

## Example coverage today

| Area                 | Example                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@atlas-ai/config`   | `packages/config/src/merge.test.ts`                                                                                    |
| `@atlas-ai/logging`  | `packages/logging/src/logger.test.ts`                                                                                  |
| Phase 1 core runtime | `tests/integration/phase1-core-runtime.test.ts` — see [Phase1-Integration-Testing.md](./Phase1-Integration-Testing.md) |
| Desktop smoke        | `apps/desktop/src/smoke.test.ts`                                                                                       |
| Rust greet helper    | `apps/desktop/src-tauri/src/lib.rs` (`tests` module)                                                                   |

---

## Writing a unit test (Vitest)

```ts
import { describe, expect, it } from "vitest";
import { parseLogLevel } from "./levels.js";

describe("parseLogLevel", () => {
  it("maps warning to warn", () => {
    expect(parseLogLevel("warning")).toBe("warn");
  });
});
```

---

## Future: Playwright + CI

1. Add Playwright under `tests/e2e/` with `playwright.config.ts`.
2. Add `pnpm test:e2e`.
3. Extend [CI-CD.md](./CI-CD.md) / `.github/workflows/ci.yml` with an e2e job when ready.

Unit Vitest + Rust tests already run in CI on every PR.
