# ADR-0037: Offline mode foundation

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/09 and NFR-OFFLINE require core assistant capabilities without internet. Atlas already defaults to local `mock` inference with `cloudProviders` and `telemetry` off, but URL model install could still pull from the network, and offline policy was not visible in status.

## Decision

1. Add `features.offlineMode` (default `true`, env `ATLAS_FEATURE_OFFLINE_MODE`).
2. Implement `packages/ai/src/offline/` with assess/status, policy (`assertNetworkOperationAllowed`), soft internet probe (display only), and CLI formatting.
3. When offlineMode is on, block URL model installs and cloud inference; allow loopback URLs for local llama-server.
4. Surface status via `atlas ai status` and `atlas ai offline`.
5. Document limitations in Offline-Mode.md; do not require cloud for local load/generate.

## Consequences

### Positive

- Explicit offline-first policy aligned with local-first product goals.
- Developers can diagnose offline readiness from the CLI.
- URL downloads remain available by toggling offlineMode off.

### Negative / trade-offs

- Default offlineMode blocks convenience URL installs until env/config override.
- Soft DNS probe is best-effort and skipped in test env.

### Follow-ups

- Auto online/offline switching UI; desktop offline banner; real offline speech engines.
