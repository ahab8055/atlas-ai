# Architecture Decision Records (ADRs)

ADRs capture significant, durable decisions so Atlas AI stays consistent as the system grows.

## When to write an ADR

Create an ADR when you:

- Choose or change a major technology (runtime, DB, packaging).
- Change package / process boundaries (e.g. in-process package vs sidecar).
- Adopt a cross-cutting convention that others must follow.
- Accept a meaningful trade-off (security, privacy, performance, scope).

Skip ADRs for trivial or easily reversible changes (typos, small refactors, dependency patch bumps).

## Process

1. Copy [`template.md`](./template.md) to `NNNN-short-kebab-title.md` (next free number).
2. Fill **Status**, **Context**, **Decision**, **Consequences**.
3. Open a PR (`docs/...` branch) and link related Architecture / product docs.
4. After merge, set status to **Accepted** (or **Deprecated** / **Superseded by ADR-XXXX** later).

## Index

| ADR                                                       | Title                                   | Status   |
| --------------------------------------------------------- | --------------------------------------- | -------- |
| [0001](./0001-record-architecture-decisions.md)           | Record architecture decisions as ADRs   | Accepted |
| [0002](./0002-documentation-structure.md)                 | Adopt organized documentation structure | Accepted |
| [0003](./0003-configuration-management.md)                | Configuration management approach       | Accepted |
| [0004](./0004-structured-logging.md)                      | Structured local logging                | Accepted |
| [0005](./0005-github-actions-ci.md)                       | GitHub Actions CI for pull requests     | Accepted |
| [0006](./0006-security-baseline.md)                       | Security baseline package and rules     | Accepted |
| [0007](./0007-request-processing-pipeline.md)             | Request processing pipeline in core     | Accepted |
| [0008](./0008-intent-detection-registry.md)               | Intent detection registry               | Accepted |
| [0009](./0009-context-management.md)                      | Context management providers            | Accepted |
| [0010](./0010-task-planning-engine.md)                    | Task planning engine                    | Accepted |
| [0011](./0011-execution-controller.md)                    | Execution controller                    | Accepted |
| [0012](./0012-tool-registry.md)                           | Central tool registry package           | Accepted |
| [0013](./0013-tool-execution-framework.md)                | Tool execution framework                | Accepted |
| [0014](./0014-permission-management-foundation.md)        | Permission management foundation        | Accepted |
| [0015](./0015-response-generation-system.md)              | Response generation system              | Accepted |
| [0016](./0016-event-system-integration.md)                | Event system integration                | Accepted |
| [0017](./0017-command-line-interface.md)                  | Command line interface adapter          | Accepted |
| [0018](./0018-core-database-integration.md)               | Core database integration               | Accepted |
| [0019](./0019-task-history-tracking.md)                   | Task history tracking                   | Accepted |
| [0020](./0020-error-handling-framework.md)                | Error handling framework                | Accepted |
| [0021](./0021-phase1-core-runtime-integration-tests.md)   | Phase 1 core runtime integration tests  | Accepted |
| [0022](./0022-ai-runtime-foundation.md)                   | AI runtime foundation                   | Accepted |
| [0023](./0023-llamacpp-integration.md)                    | llama.cpp integration                   | Accepted |
| [0024](./0024-model-registry.md)                          | Model registry                          | Accepted |
| [0025](./0025-model-storage-manager.md)                   | Model storage manager                   | Accepted |
| [0026](./0026-hardware-detection.md)                      | Hardware detection system               | Accepted |
| [0027](./0027-hardware-profile-management.md)             | Hardware profile management             | Accepted |
| [0028](./0028-model-installation-workflow.md)             | Model installation workflow             | Accepted |
| [0029](./0029-model-compatibility-checker.md)             | Model compatibility checker             | Accepted |
| [0030](./0030-model-router.md)                            | Model router system                     | Accepted |
| [0031](./0031-inference-configuration.md)                 | Inference configuration system          | Accepted |
| [0032](./0032-model-runtime-manager.md)                   | Model runtime manager                   | Accepted |
| [0033](./0033-quantization-support.md)                    | GGUF quantization support               | Accepted |
| [0034](./0034-embedding-model-integration.md)             | Embedding model integration             | Accepted |
| [0035](./0035-speech-model-foundation.md)                 | Speech model preparation foundation     | Accepted |
| [0036](./0036-ai-runtime-monitoring.md)                   | AI runtime monitoring foundation        | Accepted |
| [0037](./0037-offline-mode.md)                            | Offline mode foundation                 | Accepted |
| [0038](./0038-ai-provider-abstraction.md)                 | AI provider abstraction layer           | Accepted |
| [0039](./0039-phase2-local-ai-integration-tests.md)       | Phase 2 Local AI integration tests      | Accepted |
| [0040](./0040-memory-architecture-foundation.md)          | Memory architecture foundation          | Accepted |
| [0041](./0041-short-term-memory.md)                       | Short-term memory                       | Accepted |
| [0042](./0042-long-term-memory.md)                        | Long-term memory                        | Accepted |
| [0043](./0043-memory-classification-engine.md)            | Memory classification engine            | Accepted |
| [0044](./0044-memory-retrieval-engine.md)                 | Memory retrieval engine                 | Accepted |
| [0045](./0045-memory-consolidation-service.md)            | Memory consolidation service            | Accepted |
| [0046](./0046-knowledge-graph-data-model.md)              | Knowledge graph data model              | Accepted |
| [0047](./0047-knowledge-graph-entity-extraction.md)       | Knowledge graph entity extraction       | Accepted |
| [0048](./0048-knowledge-graph-relationship-management.md) | Knowledge graph relationship management | Accepted |
| [0049](./0049-knowledge-graph-context-retrieval.md)       | Knowledge graph context retrieval       | Accepted |
| [0050](./0050-user-profile-management.md)                 | User profile management                 | Accepted |
| [0051](./0051-workspace-awareness.md)                     | Workspace awareness                     | Accepted |
| [0052](./0052-preference-learning-engine.md)              | Preference learning engine              | Accepted |
| [0053](./0053-context-builder.md)                         | Context Builder                         | Accepted |
| [0054](./0054-context-compression.md)                     | Context compression                     | Accepted |
| [0055](./0055-memory-search-api.md)                       | Memory Search API                       | Accepted |
| [0056](./0056-memory-security.md)                         | Memory Security                         | Accepted |
| [0057](./0057-memory-backup-recovery.md)                  | Memory Backup and Recovery              | Accepted |
| [0058](./0058-memory-analytics.md)                        | Memory Analytics                        | Accepted |
| [0059](./0059-phase3-memory-integration-tests.md)         | Phase 3 Memory integration tests        | Accepted |
| [0060](./0060-platform-abstraction.md)                    | Host OS platform abstraction            | Accepted |
| [0061](./0061-platform-detection.md)                      | Platform detection service              | Accepted |
| [0062](./0062-operating-system-interface.md)              | Common operating system interface       | Accepted |
| [0063](./0063-windows-platform-provider.md)               | Windows platform provider               | Accepted |
| [0064](./0064-macos-platform-provider.md)                 | macOS platform provider                 | Accepted |
| [0065](./0065-linux-platform-provider.md)                 | Linux platform provider                 | Accepted |
| [0066](./0066-os-permission-broker.md)                    | OS permission broker                    | Accepted |
| [0067](./0067-platform-service-registry.md)               | Platform service registry               | Accepted |
| [0068](./0068-os-error-translation.md)                    | OS error translation framework          | Accepted |
| [0069](./0069-platform-event-integration.md)              | Platform event integration              | Accepted |
| [0070](./0070-platform-configuration-management.md)       | Platform configuration management       | Accepted |
| [0071](./0071-platform-logging-diagnostics.md)            | Platform logging and diagnostics        | Accepted |
| [0072](./0072-platform-unit-testing.md)                   | Platform unit testing and coverage      | Accepted |
| [0073](./0073-phase4-platform-integration-tests.md)       | Phase 4 platform integration tests      | Accepted |
| [0074](./0074-file-system-access-service.md)              | File System Access product layer        | Accepted |
| [0075](./0075-directory-navigation.md)                    | Directory navigation + symlinks         | Accepted |
| [0076](./0076-file-search-engine.md)                      | File search engine                      | Accepted |
| [0077](./0077-file-metadata-service.md)                   | File metadata service                   | Accepted |

## Naming

```
NNNN-short-kebab-title.md
```

Examples: `0003-use-pnpm-workspaces.md`, `0004-sqlite-as-primary-store.md`

## Related

- [Documentation hub](../README.md)
- [Architecture index](../Architecture/README.md)
- [guides/Code-Quality-Standards.md](../guides/Code-Quality-Standards.md)
