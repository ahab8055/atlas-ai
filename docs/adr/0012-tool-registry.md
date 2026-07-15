# ADR-0012: Central tool registry package

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Architecture/05 requires every capability to be an explicit registered tool with name, description, version, parameters, permissions, and risk. Agents must discover tools dynamically. Core previously hard-coded stub branches in `executeToolStep`, which does not scale and lacks versioning/metadata.

## Decision

1. Create `@atlas-ai/tools` with `ToolRegistry`, metadata schema, discovery query API, and semver version maps.
2. Define a consistent `ToolHandler.execute(input, context) → ToolResult` interface.
3. Ship MVP builtins that self-register on package import.
4. Have `@atlas-ai/core` execution call `registry.invoke` instead of per-tool `if` chains.
5. Support `registerTool` / custom registries for plugins later.

## Consequences

### Positive

- Tools register themselves with a consistent interface.
- Atlas can list/discover tools (`list`, `discover`, CLI `tools`).
- Versioned registrations (`name@version`, latest resolution).
- Aligns with Tool Registry + Tool Schema in Architecture/05.

### Negative / trade-offs

- Input validation is a JSON-Schema subset (required/types), not full AJV.
- Handlers are still stubs (no real OS actions yet).

### Follow-ups

- Real filesystem/terminal/application executors.
- Async tool job tracking via ExecutionController.
- Plugin install path into the same registry.
