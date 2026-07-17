# Atlas AI — Configuration Management

Centralized configuration for development, test, and production — with secrets kept out of source control.

Related: [`@atlas-ai/config`](../../packages/config/), [`config/`](../../config/), [ADR-0003](../adr/0003-configuration-management.md), [Security Architecture § Secrets](../Architecture/06-Security-Architecture.md).

---

## Goals

- One loading path for apps and packages (`loadConfig`).
- Separate **non-secret** defaults per environment.
- Secrets only via environment (and later OS keychain) — never in JSON or committed files.
- Safe for local-first / offline MVP (cloud keys optional).

---

## Layout

```
atlas-ai/
├── config/
│   ├── development.json    # committed defaults
│   ├── production.json
│   ├── test.json
│   └── *.local.json        # optional, gitignored machine overlays
├── .env.example            # template (tracked)
├── .env                    # local secrets & overrides (gitignored)
└── packages/config/        # @atlas-ai/config loader
```

---

## Loading strategy (precedence)

Later layers win:

1. **Package defaults** (`DEFAULT_APP_CONFIG`)
2. **`config/{env}.json`** — committed, environment-specific, non-secret
3. **`config/{env}.local.json`** — optional local overlay (gitignored)
4. **`.env` file** — fills keys that are not already in the process environment
5. **Process environment** — `ATLAS_*` and secret keys (highest priority)

```ts
import { loadConfig } from "@atlas-ai/config";

const config = loadConfig({
  repoRoot: process.cwd(), // monorepo root
  // env: "production",   // optional explicit override
});
```

Resolve environment from `ATLAS_ENV` (`development` | `production` | `test`), defaulting to `development`.

---

## Non-secret settings

Stored in `config/*.json` and/or overridden with:

| Variable                                     | Maps to                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `ATLAS_ENV`                                  | `config.env`                                        |
| `ATLAS_LOG_LEVEL`                            | `config.logLevel`                                   |
| `ATLAS_DATA_DIR`                             | `config.paths.dataDir`                              |
| `ATLAS_MODELS_DIR`                           | `config.paths.modelsDir`                            |
| `ATLAS_DATABASE_PATH`                        | `config.paths.databasePath`                         |
| `ATLAS_HOST`                                 | `config.server.host`                                |
| `ATLAS_PORT`                                 | `config.server.port`                                |
| `ATLAS_FEATURE_CLOUD_PROVIDERS`              | `config.features.cloudProviders` (`true`/`false`)   |
| `ATLAS_FEATURE_TELEMETRY`                    | `config.features.telemetry` (`true`/`false`)        |
| `ATLAS_FEATURE_OFFLINE_MODE`                 | `config.features.offlineMode` (`true`/`false`)      |
| `ATLAS_MEMORY_SHORT_TERM_MAX_ENTRIES`        | `config.memory.shortTerm.maxEntries`                |
| `ATLAS_MEMORY_SHORT_TERM_TTL_MS`             | `config.memory.shortTerm.ttlMs` (0 disables TTL)    |
| `ATLAS_MEMORY_CLASSIFY_MIN_IMPORTANCE`       | `config.memory.classification.minImportanceToStore` |
| `ATLAS_MEMORY_CLASSIFY_MIN_CONFIDENCE`       | `config.memory.classification.minConfidenceToStore` |
| `ATLAS_MEMORY_CLASSIFY_TEMPORARY_TTL_MS`     | `config.memory.classification.temporaryTtlMs`       |
| `ATLAS_MEMORY_RETRIEVAL_LIMIT`               | `config.memory.retrieval.limit`                     |
| `ATLAS_MEMORY_RETRIEVAL_MIN_SCORE`           | `config.memory.retrieval.minScore`                  |
| `ATLAS_MEMORY_RETRIEVAL_RECENCY_HALFLIFE_MS` | `config.memory.retrieval.recencyHalfLifeMs`         |

Public frontend values may use `VITE_*` (e.g. `VITE_ATLAS_API_URL`) and must never include secrets.

---

## Secrets

| Variable            | Purpose                 |
| ------------------- | ----------------------- |
| `OPENAI_API_KEY`    | Optional cloud provider |
| `ANTHROPIC_API_KEY` | Optional cloud provider |

Rules:

- **Do not** put secrets in `config/*.json`, source code, or `VITE_*` variables.
- **Do not** commit `.env` or `config/*.local.json`.
- Prefer leaving cloud keys empty for offline MVP.
- Security Architecture targets **OS keychain** for MVP secret storage; env vars are the interim loading source until that adapter ships. The `AtlasSecrets` type is the extension point.

---

## Environment profiles

| Profile       | File                      | Typical use                             |
| ------------- | ------------------------- | --------------------------------------- |
| `development` | `config/development.json` | Local `pnpm dev`                        |
| `production`  | `config/production.json`  | Packaged / release builds               |
| `test`        | `config/test.json`        | Automated tests (isolated `.data/test`) |

Switch with:

```bash
ATLAS_ENV=production pnpm --filter @atlas-ai/config test:load
```

---

## Developer setup

```bash
cp .env.example .env
pnpm setup
pnpm --filter @atlas-ai/config build
pnpm config:print    # from repo root — prints resolved config (secrets redacted in docs; print shows presence only if you log carefully)
```

When logging config in apps, **never log `config.secrets` values**.

---

## Adding a setting

1. Add the field to `AtlasAppConfig` (or `AtlasSecrets` if sensitive).
2. Update defaults + each `config/{env}.json`.
3. Map an `ATLAS_*` override in `applyEnvOverrides` if needed.
4. Document it here and in `.env.example`.
