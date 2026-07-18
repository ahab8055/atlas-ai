# ADR-0056: Memory Security

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Architecture requires encrypted memory storage, access control, and audit of
create/retrieve/delete. Long-term memories were plaintext SQLite rows with no
`memory.*` capabilities and hard deletes only. Full-DB SQLCipher is not in the
MVP tech stack (OS keychain + secure storage APIs).

## Decision

1. **Field-level AES-256-GCM** for memories with `sensitivity: "sensitive"`;
   normal rows stay plaintext. Columns: `sensitivity`, `encrypted`,
   `content_nonce` (schema v10).
2. Sync DEK via injectable `MemoryDekProvider`; CLI persists DEK beside the DB
   until OS keychain adapters exist. Crypto helpers live in `@atlas-ai/security`.
3. Capabilities **`memory.read` (L1)**, **`memory.write` (L2)**,
   **`memory.delete` (L3)** on `PermissionManager`.
4. **`secureDelete`**: overwrite content then `DELETE`; CLI delete/clear/purge
   require `--confirm` to grant `memory.delete`.
5. **`MemoryAccessLog`** + structured logs (`category: "security"`) record
   actions with ids/sensitivity only — never plaintext content.

## Consequences

### Positive

- Sensitive memories are ciphertext at rest; unauthorized access is blocked when
  a permission manager is configured.
- Search still works by decrypting candidates in-process with the DEK.
- Aligns with existing permission and secure-storage foundations.

### Negative / trade-offs

- Non-sensitive rows remain plaintext; not full-DB encryption.
- DEK file on disk is weaker than OS keychain (interim).
- Audit is process-local until a durable table is added.

### Follow-ups

- OS Keychain adapters for DEK.
- Optional SQLCipher / whole-file encryption.
- Persist memory access events to SQLite.
