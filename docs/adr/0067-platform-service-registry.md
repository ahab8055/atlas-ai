# ADR-0067: Platform service registry

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

`PlatformManager` builds and exposes `PlatformServices`, but consumers
(especially `@atlas-ai/core`) called `getDefaultPlatformManager()` directly.
That couples modules to the factory/singleton internals and does not provide a
clear startup registration or dynamic resolve API. Architecture/11’s Local
Service Manager direction and the OS abstraction user story require a registry
so Atlas modules locate OS services without importing platform providers.

## Decision

1. Add **`PlatformServiceRegistry`** holding a registered `PlatformServices`
   bundle with `resolve(key)` / typed getters (`getOs()`, `getInfo()`, …).
2. Keep **`PlatformManager` as the factory** (adapter selection, permission
   broker wrap). The registry is lookup / DI only — not a second adapter
   switch.
3. **Startup:** `bootstrapPlatformServices(options)` creates a manager, sets
   it as default, and registers services on the default registry
   (`replace: true`).
4. **Singleton lifecycle:** `getDefaultPlatformServiceRegistry` /
   `setDefaultPlatformServiceRegistry`, plus `setDefaultPlatformManager`.
5. **Lazy fallback:** first resolve on an empty default registry loads services
   from `getDefaultPlatformManager()` once.
6. Core pipeline / system-state resolve platform identity via the registry
   (optional `PipelineOptions.platformRegistry` for DI).

## Consequences

### Positive

- Modules stay loosely coupled to OS interfaces, not providers.
- Explicit startup registration and testable DI overrides.
- Matches existing Atlas default patterns (tools, permissions, context).

### Negative / trade-offs

- Two related singletons (manager + registry) must stay in sync when hosts
  replace one; prefer `bootstrapPlatformServices` or
  `registerFromManager` after `setDefaultPlatformManager`.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0060](./0060-platform-abstraction.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [Architecture/11](../Architecture/11-Desktop-Application-Architecture.md)
