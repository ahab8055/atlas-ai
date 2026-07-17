# Atlas AI — Memory Classification

Heuristic gate before long-term storage: score importance/confidence, choose type and durability, discard low-value chatter, and optionally expire borderline rows.

Related: [Long-Term-Memory.md](./Long-Term-Memory.md), [Short-Term-Memory.md](./Short-Term-Memory.md), [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md) (Importance Scoring), [ADR-0043](../adr/0043-memory-classification-engine.md), [`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Do **not** store everything (Architecture: coffee chatter is discarded)
- Prefer explicit "remember …", lasting preferences, project facts, workflows
- Deterministic heuristics only (no LLM classifier in MVP)

---

## Flow

```
Candidate text
  → classifyMemory()
  → action: discard | short_term | store_long_term
  → evaluateAndStore() writes SQLite only for store_long_term
```

Temporary / `short_term` actions do **not** write the `memories` table. Manual `LongTermMemory.store()` bypasses the classifier (CLI `memory add --type`).

---

## Defaults

| Setting                | Default | Meaning                        |
| ---------------------- | ------- | ------------------------------ |
| `minImportanceToStore` | 0.45    | Below → discard                |
| `minConfidenceToStore` | 0.35    | Below → discard                |
| `temporaryTtlMs`       | 24h     | Soft TTL for temporary content |

Explicit "remember …" → importance ≥ 0.9, confidence ≥ 0.85, permanent.

Config: `memory.classification.*`

Env:

- `ATLAS_MEMORY_CLASSIFY_MIN_IMPORTANCE`
- `ATLAS_MEMORY_CLASSIFY_MIN_CONFIDENCE`
- `ATLAS_MEMORY_CLASSIFY_TEMPORARY_TTL_MS`

---

## API

```ts
import {
  classifyMemory,
  createLongTermMemory,
  purgeExpiredMemories,
} from "@atlas-ai/memory";

const decision = classifyMemory({
  text: "I like dark mode interfaces.",
});
// action: store_long_term, type: semantic

const ltm = createLongTermMemory(db.memories);
const result = ltm.evaluateAndStore("Remember my API key lives in .env");
// result.stored === true

ltm.purgeExpired(); // deletes metadata.expiresAt in the past
```

---

## CLI

```bash
# No database required
pnpm atlas memory classify "I like dark mode interfaces."
pnpm atlas memory classify "This coffee tastes good."

# Classify then store when above thresholds (requires DB)
pnpm atlas memory add --classify "I prefer TypeScript"

# Remove expired long-term rows
pnpm atlas memory purge-expired
```

---

## Architecture examples

| Text                                | Expected                     |
| ----------------------------------- | ---------------------------- |
| "I like dark mode interfaces."      | `store_long_term` / semantic |
| "This coffee tastes good."          | `discard`                    |
| "Remember my API key lives in .env" | permanent, high scores       |

---

## Out of scope

- LLM-based classification
- Auto-capturing every conversation turn into long-term
- Embedding re-scoring of importance
