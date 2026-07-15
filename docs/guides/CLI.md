# Atlas AI — Command Line Interface

Terminal adapter for testing Atlas before the full desktop UI.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [`@atlas-ai/cli`](../../apps/cli/), [`@atlas-ai/core`](../../packages/core/), [ADR-0017](../adr/0017-command-line-interface.md), [Event-System.md](./Event-System.md), [Logging.md](./Logging.md).

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

---

## Options

| Flag / env             | Meaning                          |
| ---------------------- | -------------------------------- |
| `-i` / `--interactive` | REPL                             |
| `-d` / `--debug`       | Debug mode                       |
| `-q` / `--quiet`       | Response only                    |
| `--session <id>`       | Conversation session id          |
| `-h` / `--help`        | CLI help (not the `help` intent) |
| `ATLAS_LOG_LEVEL`      | Log level when not debug/quiet   |

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
