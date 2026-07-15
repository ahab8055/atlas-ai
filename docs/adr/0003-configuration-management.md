# ADR-0003: Configuration management approach

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 0 requires configuration management that supports multiple environments without storing secrets in source. Security Architecture forbids plaintext API keys in the repo and points MVP secret storage at the OS keychain (with env as a practical interim).

## Decision

1. Commit **non-secret** defaults under `config/{development,production,test}.json`.
2. Load settings through **`@atlas-ai/config`** (`loadConfig`) with precedence:
   defaults → env JSON → optional `*.local.json` → `.env` → process env.
3. Keep **secrets** only in environment / `.env` (gitignored), exposed as `config.secrets`, never in JSON.
4. Use `ATLAS_ENV` to select the profile; use `ATLAS_*` for overrides.
5. Defer OS keychain integration to a later adapter that fills `AtlasSecrets` without changing call sites.

## Consequences

### Positive

- Clear split between portable defaults and machine secrets.
- Same API for desktop, packages, and scripts.
- Aligns with local-first / privacy-first MVP.

### Negative / trade-offs

- Developers must remember not to put secrets in JSON.
- Keychain is not wired yet; env remains the secret source for now.

### Follow-ups

- Documented in [`guides/Configuration.md`](../guides/Configuration.md).
- Add keychain-backed secret provider when Security MVP work lands.
