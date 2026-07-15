# Atlas AI — environment configuration files

Committed **non-secret** defaults per environment. Loaded by `@atlas-ai/config`.

| File               | Environment               |
| ------------------ | ------------------------- |
| `development.json` | Local development         |
| `production.json`  | Production / packaged app |
| `test.json`        | Automated tests           |

## Rules

- **Never** put API keys, tokens, passwords, or other secrets in these JSON files.
- Secrets belong in process environment / `.env` (gitignored), and later OS keychain (see Security Architecture).
- Override any value with `ATLAS_*` environment variables (see `docs/guides/Configuration.md`).

Local overlays (optional, gitignored): `config/*.local.json`.
