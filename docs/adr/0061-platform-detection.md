# ADR-0061: Platform detection service

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

ADR-0060 introduced `@atlas-ai/platform` with `PlatformManager` and a minimal
`PlatformInfo` (`id`, `arch`, `runtime: "node"`). Atlas still needed a named
detector that returns OS family, architecture, kernel/release, and runtime
environment so adapters load from standardized data—and so core can expose
detection without calling `node:os` directly.

## Decision

1. Add **`PlatformDetector`** (`detect()` / `detectId()`) backed by an injectable
   **`OsProbe`** (`createNodeOsProbe` wraps `node:os` / `process`).
2. Enrich **`PlatformInfo`**: `os` (macos/windows/linux), `kernelVersion`
   (`os.release()`), `osType`, optional `osVersion`, and
   `runtime: { kind: "node", version }`.
3. **`PlatformManager.create`** uses the detector for `PlatformServices.info`
   unless overridden; tests may inject `probe` or partial info.
4. Core `SystemStateInfo` gains optional `kernelVersion` from `PlatformInfo`.

No shell/`uname` spawning—`os.release()` covers Win/macOS/Linux kernel strings.

## Consequences

### Positive

- Single detection API for OS / arch / kernel / runtime.
- Testable via mock `OsProbe`.
- Abstraction layer and core context both expose detection results.

### Negative / trade-offs

- `PlatformInfo.runtime` shape changed from string `"node"` to an object
  (breaking for any early callers of the ADR-0060 shape).
- Hardware metrics remain in AI `SystemProbe` (separate concern).

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0060](./0060-platform-abstraction.md)
- [ADR-0026](./0026-hardware-detection.md)
