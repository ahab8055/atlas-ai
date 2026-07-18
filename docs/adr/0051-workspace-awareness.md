# ADR-0051: Workspace awareness

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

`LoadedContext.project` existed as a stub (`name: "Atlas AI"`). Product
requirements ask Atlas to detect project folders, track repositories,
associate memories with projects, store metadata, and auto-load project
context. Docs previously omitted a dedicated `projects` table.

## Decision

1. Schema v8: `projects` table + `memories.project_id`.
2. Package `@atlas-ai/workspace`: filesystem detection (`.git` / markers),
   `WorkspaceManager` registry, active project preference key.
3. Config `workspace.autoDetect` / `rememberOnDetect`.
4. CLI: `atlas project detect|list|get|use|status`; wire loader into
   `ContextManager` and pass `projectId` into memory retrieval.
5. Planner/response surface **Active project** when path/name present.
6. Memory retrieve uses `project_id = active OR NULL`, project-scoped first.

## Consequences

### Positive

- Active project persists and loads automatically from cwd.
- Repo URL/branch tracked when `.git` is present.
- Project-scoped memories improve relevance.

### Negative / trade-offs

- Detection is heuristic (markers), not IDE multi-root workspaces.
- No `git` CLI porcelain / status.

### Follow-ups

- Link KG `project` entities to `projects.id`.
- Wire `project.open` tool to OS open.
- Optional LTM auto-tag on store with active project.
