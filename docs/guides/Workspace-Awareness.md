# Atlas AI — Workspace Awareness

Detect project folders, track repositories, associate memories with projects,
and auto-load the active project into request context.

Related: [Context-Management.md](./Context-Management.md),
[Database.md](./Database.md),
[User-Profile.md](./User-Profile.md),
[ADR-0051](../adr/0051-workspace-awareness.md),
[`@atlas-ai/workspace`](../../packages/workspace/).

---

## Goals

- Detect project roots from cwd (`.git` or markers like `package.json`)
- Persist project metadata (path, repo URL, branch)
- Auto-load active project into `LoadedContext.project`
- Scope long-term memory retrieval to the active project (+ unscoped)

---

## Detection

Walk parents from cwd until:

1. `.git` directory (reads `origin` URL + HEAD branch from files), or
2. Markers: `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, …

---

## Config (`workspace`)

| Key                | Default | Meaning                      |
| ------------------ | ------- | ---------------------------- |
| `autoDetect`       | `true`  | Detect on CLI runtime create |
| `rememberOnDetect` | `true`  | Upsert into `projects`       |

Env: `ATLAS_WORKSPACE_AUTO_DETECT`, `ATLAS_WORKSPACE_REMEMBER_ON_DETECT`.

---

## CLI

```bash
atlas project detect [--cwd PATH] [--no-remember]
atlas project list
atlas project get <id>
atlas project use <id|path>
atlas project status
```

---

## Memory association

`memories.project_id` links rows to `projects.id`. Retrieval with an active
project returns `project_id = active OR project_id IS NULL`, ranking
project-scoped hits first.

---

## Out of scope

- Multi-root IDE workspaces
- Full git status via CLI
- `project.open` OS launcher
