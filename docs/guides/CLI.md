# Atlas AI — Command Line Interface

Terminal adapter for testing Atlas before the full desktop UI.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [`@atlas-ai/cli`](../../apps/cli/), [`@atlas-ai/core`](../../packages/core/), [ADR-0017](../adr/0017-command-line-interface.md), [Database.md](./Database.md), [Event-System.md](./Event-System.md), [Logging.md](./Logging.md).

---

## Purpose

- Accept user commands in the terminal
- Run them through the **core runtime** (`handleRequest` / `createRequestHandler`)
- Display Atlas responses on stdout
- Support **debug mode** for developers

The CLI is a thin **input adapter**. Desktop and voice will call the same core API with `source: "desktop"` or `"voice"` — no pipeline fork.

```
Terminal  →  @atlas-ai/cli  →  @atlas-ai/core  →  response.text → stdout
                              (source: "cli")
```

---

## Usage

```bash
pnpm packages:build && pnpm cli:build

pnpm atlas help
pnpm atlas status
pnpm atlas echo hello world
pnpm atlas "Open VS Code"
```

### Interactive mode

```bash
pnpm atlas -i
pnpm atlas --interactive --session my-dev
```

Prompt: `atlas>`. Same core pipeline; conversation session stays alive. Type `exit` or `quit` to leave.

### Debug mode

```bash
pnpm atlas --debug status
pnpm atlas -d -i
ATLAS_CLI_DEBUG=1 pnpm atlas "Prepare my development environment"
```

Debug prints to **stderr**:

- Orchestration events from the event bus (`RequestReceived`, `IntentDetected`, …)
- Stage logs (JSON via `@atlas-ai/logging`, level `debug`)
- Compact result meta after each response (intent, status, plan, trace)

Response text stays on **stdout** (scriptable).

### Quiet mode

```bash
pnpm atlas --quiet status
ATLAS_CLI_QUIET=1 pnpm atlas status
```

### Database

SQLite initializes automatically (default `.data/atlas.sqlite`). Each command syncs tools and records execution history — see [Database.md](./Database.md) and [Task-History.md](./Task-History.md).

```bash
pnpm atlas --db /tmp/atlas.sqlite status
pnpm atlas history
pnpm atlas history --status blocked --limit 5
pnpm atlas --no-db status
```

### Local AI runtime

Probe the inference facade without running the request pipeline — see [Local-AI-Runtime.md](./Local-AI-Runtime.md) and [Model-Registry.md](./Model-Registry.md).

```bash
pnpm atlas ai status
pnpm atlas ai register   # persist GGUF metadata
pnpm atlas ai models
pnpm atlas ai storage    # usage + directory layout
pnpm atlas ai validate   # detect invalid weights
pnpm atlas ai hardware   # classify profile + recommendations
pnpm atlas ai profiles   # low / balanced / performance
pnpm atlas ai recommend  # ranked models for this machine
pnpm atlas ai install ./model.gguf general
pnpm atlas ai check general/model
pnpm atlas ai route "Summarize this note"
pnpm atlas ai ask "hello"
```

```bash
pnpm atlas ai status
ATLAS_AI_PROVIDER=llamacpp pnpm atlas ai status
```

---

## Options

| Flag / env             | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| `-i` / `--interactive` | REPL                                       |
| `-d` / `--debug`       | Debug mode                                 |
| `-q` / `--quiet`       | Response only                              |
| `--session <id>`       | Conversation session id                    |
| `--db <path>`          | SQLite path (default `.data/atlas.sqlite`) |
| `--no-db`              | Skip database for this run                 |
| `-h` / `--help`        | CLI help (not the `help` intent)           |
| `ATLAS_DB_PATH`        | Default database path                      |
| `ATLAS_DB_DISABLED=1`  | Same as `--no-db`                          |
| `ATLAS_LOG_LEVEL`      | Log level when not debug/quiet             |

---

## Exit codes

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | Response status `completed`                   |
| `1`  | Non-completed (blocked / failed / …) or error |
| `2`  | Invalid usage (bad flags)                     |

---

## Package layout

`apps/cli/src/` — `main`, `parse-args`, `run`, `display`, `repl`, `options`.
