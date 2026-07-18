# Atlas AI — Memory Backup and Recovery

Portable export/import of long-term memories with integrity checks and optional
passphrase encryption (ADR-0057).

Related: [Long-Term-Memory.md](./Long-Term-Memory.md),
[Memory-Security.md](./Memory-Security.md),
[Memory-Analytics.md](./Memory-Analytics.md),
[CLI.md](./CLI.md),
[ADR-0057](../adr/0057-memory-backup-recovery.md),
[ADR-0056](../adr/0056-memory-security.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Export memories so they survive reinstall / device change
- Import and restore with merge or replace
- Validate checksum before applying
- Support encrypted backup files (passphrase + AES-256-GCM)

---

## Format

### Plaintext snapshot (`.json`)

```json
{
  "format": "atlas.memory.backup",
  "version": 1,
  "exportedAt": "2026-07-18T12:00:00.000Z",
  "count": 2,
  "checksum": "<sha256 hex of canonical memories array>",
  "memories": [ { "id": "…", "type": "semantic", "content": "…", … } ]
}
```

Sensitive rows are **decrypted** into the snapshot (portable). On import they
are re-encrypted with the local DEK when `sensitivity: "sensitive"`.

### Encrypted envelope (`.atlasmem`)

```json
{
  "format": "atlas.memory.backup.encrypted",
  "version": 1,
  "kdf": "scrypt",
  "salt": "<base64>",
  "nonce": "<base64>",
  "ciphertext": "<base64 AES-GCM of snapshot JSON>"
}
```

Passphrase → scrypt → AES-256-GCM. Distinct from at-rest `memory.dek`
(ADR-0056): backup passphrase travels with the user across devices.

---

## API

```ts
const snap = ltm.exportBackup({ type: "semantic" });
const check = ltm.validateBackup(snap);
ltm.importBackup(snap, { mode: "merge" }); // or "replace"
```

Permissions: `memory.read` (export), `memory.write` (import), `memory.delete`
(replace).

---

## CLI

```bash
# Plain JSON
pnpm atlas memory export --out ~/atlas-memory.json
pnpm atlas memory import ~/atlas-memory.json --validate-only
pnpm atlas memory import ~/atlas-memory.json

# Encrypted (passphrase in env)
export ATLAS_BACKUP_PASSPHRASE='…'
pnpm atlas memory export --out ~/atlas-memory.atlasmem --encrypt
pnpm atlas memory import ~/atlas-memory.atlasmem

# Replace all then restore
pnpm atlas memory import ~/atlas-memory.json --replace --confirm
```

---

## Out of scope

- Full `.atlasbackup` (settings / workflows / plugins)
- Cloud upload / scheduled backups
- Raw SQLite file copy
