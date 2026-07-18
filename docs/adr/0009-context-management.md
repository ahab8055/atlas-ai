# ADR-0009: Context management providers

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 requires Atlas to collect relevant context before execution (conversation, preferences, active tasks, system state) with a defined structure. Architecture/22 Context Manager also names project context and user memory. Memory and knowledge graph packages are not ready, but the pipeline must not hard-code a stub that blocks them.

## Decision

1. Add a `ContextManager` in `@atlas-ai/core` that loads context via pluggable `ContextProvider`s before planning.
2. Define a canonical `LoadedContext` shape covering conversation, preferences, active tasks, system state, project, memories, and knowledge.
3. Ship in-memory conversation / preference / task stores for MVP; default `memory` and `knowledge` providers return empty arrays and accept retriever injectors.
4. Record assistant replies after response generation for conversation continuity.
5. Allow `handleRequest` / `runPipeline` to accept a `contextManager` for isolation and future DI.

## Consequences

### Positive

- Context is collected before execution with a stable structure.
- Memory and knowledge graph integrate by registering providers (no pipeline rewrite).
- Matches Architecture Context Manager source list.

### Negative / trade-offs

- Default conversation history is process-local (lost on restart) until durable memory exists.
- Preference defaults are simplistic (`preferredEditor: VS Code`).

### Follow-ups

- Wire `@atlas-ai/memory` retrieval into `createMemoryProvider`.
- ~~Wire knowledge graph into `createKnowledgeProvider`.~~ Done (ADR-0046).
- Persist conversation store for desktop sessions.
