# ADR-0057: Memory Backup and Recovery

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Users need to export and restore long-term memories after reinstall or device
change. Architecture calls for MVP local export and future encrypted portable
backups. No export/import API existed; knowledge graph JSON export was the
closest pattern. Full SQLite copy is a poor fit (live DB handle, unrelated
tables, device-bound DEK).

## Decision

1. **Memory-only** versioned JSON snapshot (`atlas.memory.backup` v1) with
   SHA-256 checksum over a canonical memories array.
2. Export via decrypting `LongTermMemory.list` (sensitive content plaintext in
   the snapshot for portability); import via `store` (re-encrypts sensitive
   with local DEK).
3. Optional **passphrase-encrypted** envelope (`atlas.memory.backup.encrypted`)
   using scrypt + AES-256-GCM — independent of at-rest `memory.dek`.
4. Import modes: **merge** (upsert by id) and **replace** (clear then import;
   requires `memory.delete`).
5. CLI: `memory export` / `memory import` with `--encrypt`, `--validate-only`,
   `--replace --confirm`; passphrase from `ATLAS_BACKUP_PASSPHRASE`.

## Consequences

### Positive

- Memories export and restore successfully across devices.
- Tampered backups fail checksum validation before apply.
- Encrypted files protect backups at rest without shipping the DEK.

### Negative / trade-offs

- Snapshot holds plaintext sensitive content until the file is encrypted —
  users should prefer `--encrypt` for private notes.
- Not a full Atlas profile (`.atlasbackup`).

### Follow-ups

- Multi-domain `.atlasbackup`.
- Scheduled / automatic backups.
- Optional SQLite file-level disaster recovery.
