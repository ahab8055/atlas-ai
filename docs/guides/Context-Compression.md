# Atlas AI — Context Compression

Heuristic extractive compression of older conversation turns so the Context
Package stays within model limits while preserving important facts.

Related: [Context-Management.md](./Context-Management.md),
[ADR-0054](../adr/0054-context-compression.md),
[ADR-0053](../adr/0053-context-builder.md),
[Architecture/09-Local-AI-Architecture.md](../Architecture/09-Local-AI-Architecture.md),
[`@atlas-ai/core`](../../packages/core/src/context/).

---

## Goals

- Summarize older turns into compact fact bullets
- Keep recent turns raw
- Drop near-duplicate lines across sections
- Scale package budget from model `contextSize` when enabled

---

## Flow

```
LoadedContext.turns
  → compressConversation (if length > keepRecentTurns + 1)
  → conversation_summary section + recent raw turns
  → buildContextPackage (priority + near-dedupe + maxChars)
```

Extractive cues: prefer/always/concise, editor/language names, decided/must/use,
project/path/repo, remember/note.

---

## Config

### `context.compression`

| Key                      | Default | Meaning             |
| ------------------------ | ------- | ------------------- |
| `enabled`                | `true`  | Master switch       |
| `keepRecentTurns`        | `4`     | Raw turns kept      |
| `maxSummaryLines`        | `8`     | Summary bullet cap  |
| `nearDuplicateThreshold` | `0.85`  | Jaccard near-dedupe |

### `context.builder.scaleToModelContext`

Default `true`. Effective:

`maxChars = min(configuredMaxChars, max(1024, floor(contextSize * 4 * 0.35)))`

Env: `ATLAS_CONTEXT_COMPRESSION_ENABLED`, `ATLAS_CONTEXT_KEEP_RECENT_TURNS`,
`ATLAS_CONTEXT_SCALE_TO_MODEL`, `ATLAS_CONTEXT_MAX_CHARS`.

---

## Out of scope

- LLM / local-model summarization
- Embedding-based redundancy
- Durable SQLite rolling summaries
- STM summarize-on-evict
