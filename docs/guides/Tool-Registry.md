# Atlas AI — Tool Registry

Central registry so Atlas can discover and invoke capabilities consistently.

Related: [Architecture/05-Tool-System-Architecture.md](../Architecture/05-Tool-System-Architecture.md), [Execution-Controller.md](./Execution-Controller.md), [Security.md](./Security.md), [ADR-0012](../adr/0012-tool-registry.md), [`@atlas-ai/tools`](../../packages/tools/).

---

## Metadata format

Every tool registers:

| Field          | Required | Meaning                                   |
| -------------- | -------- | ----------------------------------------- |
| `name`         | yes      | Stable id (`file.search`)                 |
| `description`  | yes      | Human / agent readable                    |
| `version`      | yes      | Semver (`1.0.0`)                          |
| `permissions`  | yes      | `@atlas-ai/security` capabilities         |
| `risk`         | yes      | `low` \| `medium` \| `high` \| `critical` |
| `inputSchema`  | yes      | JSON-Schema subset                        |
| `outputSchema` | yes      | JSON-Schema subset                        |
| `tags`         | no       | Discovery tags                            |

Handlers implement a single interface:

```ts
execute(input, context) => ToolResult | Promise<ToolResult>
```

---

## Registration & discovery

```ts
import {
  registerTool,
  listToolMetadata,
  getDefaultToolRegistry,
} from "@atlas-ai/tools";

registerTool(
  {
    name: "demo.ping",
    description: "Ping",
    version: "1.0.0",
    permissions: ["system.info"],
    risk: "low",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  },
  () => ({ ok: true, message: "pong" }),
);

console.log(listToolMetadata().map((t) => `${t.name}@${t.version}`));

const registry = getDefaultToolRegistry();
registry.discover({ q: "file", tags: ["filesystem"] });
registry.listVersions("demo.ping");
registry.get("demo.ping", "1.0.0");
```

MVP builtins self-register on import (`system.info`, `echo`, `application.open`,
`file.search` / `file.read` / `file.write` / `file.mkdir` / `file.delete` /
`file.move`, `code.analyze`, `project.open`, `process.start`). File tools are
backed by `@atlas-ai/filesystem` — see [File-System-Access.md](./File-System-Access.md).

---

## Execution wiring

Prefer the **tool execution framework**:

```ts
import { executeTool } from "@atlas-ai/tools";

const result = executeTool({ name: "echo", input: { text: "hi" } });
```

`@atlas-ai/core` ExecutionController calls this via `executeToolStep` (input validated, errors captured, outputs returned as step results). See [Tool-Execution.md](./Tool-Execution.md).

`registry.invoke` remains a thin shortcut that returns a bare `ToolResult`.

---

## CLI

```bash
pnpm atlas tools
pnpm atlas "list tools"
pnpm atlas help   # includes registered tool names
```

---

## Commands

```bash
pnpm tools:build
pnpm test
```
