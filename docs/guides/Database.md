# Atlas AI — Database

Local SQLite persistence for configuration and core runtime data.

Related: [Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md), [Architecture/07-Data-Architecture.md](../Architecture/07-Data-Architecture.md), [Architecture/17-Technology-Stack.md](../Architecture/17-Technology-Stack.md), [`@atlas-ai/database`](../../packages/database/), [ADR-0018](../adr/0018-core-database-integration.md), [CLI.md](./CLI.md).

---

## Purpose

- Persist system settings, tool registry snapshots, execution history, and user preference placeholders
- Initialize automatically on first open (zero config)
- Stay local-first (file under `.data/` by default)

---

## Technology

| Choice       | Detail                                                            |
| ------------ | ----------------------------------------------------------------- |
| Engine       | SQLite via Node.js `node:sqlite` (`DatabaseSync`)                 |
| Package      | `@atlas-ai/database`                                              |
| Default path | `.data/atlas.sqlite` (gitignored)                                 |
| ORM          | Not yet — raw SQL migrations; Prisma/Drizzle later per stack docs |

---

## Automatic initialization

```ts
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase();
// → creates parent dirs, applies schema, seeds defaults
```

CLI opens the DB on every run unless `--no-db` / `ATLAS_DB_DISABLED=1`.

---

## Core runtime tables

| Table               | Role (Architecture/20)                                   |
| ------------------- | -------------------------------------------------------- |
| `system_config`     | Runtime / system settings                                |
| `user_preferences`  | Preference placeholders (`preferred_editor`, `theme`, …) |
| `tools`             | Tool registry persistence                                |
| `models`            | AI model registry (name, format, caps, requirements, …)  |
| `execution_history` | Pipeline / task run history                              |
| `task_executions`   | Per-step execution rows                                  |
| `schema_migrations` | Applied schema version                                   |

---

## Store and retrieve

```ts
db.systemConfig.set("logging.level", "debug");
db.systemConfig.get("logging.level");

db.userPreferences.set("theme", "dark", { category: "appearance" });
db.userPreferences.list();

db.tools.upsert({ name: "echo", description: "Echo text", version: "1.0.0" });
db.tools.list();

db.models.upsert({
  id: "phi-3",
  name: "Phi-3",
  provider: "llamacpp",
  format: "gguf",
  capabilities: ["chat"],
  location: "./models/phi-3.gguf",
});
db.models.list({ status: "available" });

db.executionHistory.record({ taskId: "…", status: "completed", steps: […] });
db.executionHistory.listRecent(20);

// Preferred for UI / review:
db.taskHistory.query({ status: "completed", limit: 20 });
db.taskHistory.getById("exec_…");
```

See also [Task-History.md](./Task-History.md).

---

## CLI

```bash
pnpm atlas status                 # auto-inits `.data/atlas.sqlite`
pnpm atlas --db /tmp/atlas.sqlite status
pnpm atlas --no-db status         # skip persistence
```

On each command the CLI syncs registered tools and appends execution history.

---

## Package layout

`packages/database/src/` — client, schema, repositories, `AtlasDatabase` facade.
