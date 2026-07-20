# Atlas AI — Phase 4 Platform Integration Tests

Cross-package Vitest suite proving OS Abstraction Layer workflows work together
across darwin / linux / win32 on a single CI host (forced `platformId` + mock
runners).

Related: [Testing.md](./Testing.md), [Platform-Abstraction.md](./Platform-Abstraction.md),
[Event-System.md](./Event-System.md), [Error-Handling.md](./Error-Handling.md),
[ADR-0073](../adr/0073-phase4-platform-integration-tests.md),
[ADR-0072](../adr/0072-platform-unit-testing.md),
[`tests/integration/`](../../tests/integration/).

---

## Scope

| Area                 | What is verified                                                          |
| -------------------- | ------------------------------------------------------------------------- |
| Provider loading     | Forced `platformId` / `info` / `getPlatform()`; `open` hits mock runner   |
| Service registration | All 13 `PlatformServiceKey` values `has` + `resolve`; nested identity     |
| Interface compliance | `assertOperatingSystemCompliance` method matrix on `OperatingSystem`      |
| Happy-path smoke     | `terminal.execute`, clipboard, notifications, `listRunning` via mocks     |
| Standardized errors  | Empty `open` → `invalid_input`; missing file → `PlatformError` + classify |
| Event publishing     | Detected → Started; deny → PermissionDenied; io_error → ProviderFailed    |
| EventBus bridge      | `createPlatformEventPublisher` delivers `atlas.platform` events           |
| Critical path        | detect → bootstrap → compliance → deny → grant → open (linux)             |

**Out of scope:** real `osascript` / PowerShell / `wmctrl`; broker capability ×
method combinatorial matrix (unit); diagnostics log message asserts; Windows /
macOS CI runners; per-provider CLI arg shapes (unit).

---

## Commands

```bash
pnpm test:integration   # packages:build + Vitest tests/integration only
pnpm exec vitest run tests/integration/phase4-platform.test.ts
pnpm test               # full Vitest suite (unit + integration)
```

---

## Layout

```
tests/integration/
├── platform-helpers.ts        # Phase 4 harness + compliance / key-matrix asserts
├── phase4-platform.test.ts    # describe.each darwin/linux/win32 + critical path
├── memory-helpers.ts          # Phase 3
├── ai-helpers.ts              # Phase 2
├── helpers.ts                 # Phase 1
└── phase{1,2,3}-*.test.ts
```

Harness always injects a matching mock runner, calls
`bootstrapPlatformServices`, and `cleanup()` resets default manager/registry.

---

## Acceptance mapping

| Acceptance criterion           | Delivery                                            |
| ------------------------------ | --------------------------------------------------- |
| Provider loading               | Matrix — forced id + mock runner smoke              |
| Service registration           | Matrix — full key resolve after bootstrap           |
| Standardized error handling    | Matrix — PlatformError codes/detail + `fromUnknown` |
| Event publishing               | Matrix — Detected/Started/Denied/Failed + EventBus  |
| Every supported platform       | `describe.each` darwin/linux/win32                  |
| Interface compliance automatic | `assertOperatingSystemCompliance`                   |
