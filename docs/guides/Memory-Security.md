# Atlas AI — Memory Security

Field-level encryption, permission gates, secure deletion, and access audit for
long-term memories (ADR-0056).

Related: [Security.md](./Security.md), [Long-Term-Memory.md](./Long-Term-Memory.md),
[Memory-Search.md](./Memory-Search.md), [CLI.md](./CLI.md),
[ADR-0056](../adr/0056-memory-security.md), [ADR-0006](../adr/0006-security-baseline.md),
[ADR-0014](../adr/0014-permission-management-foundation.md),
[`@atlas-ai/memory`](../../packages/memory/), [`@atlas-ai/security`](../../packages/security/).

---

## Goals

- Encrypt memories marked `sensitive` at rest (AES-256-GCM)
- Gate read/write/delete via `memory.*` capabilities
- Secure-delete (overwrite then DELETE)
- Audit create/read/update/delete/search without logging plaintext content

---

## Sensitivity + encryption

| Sensitivity        | At rest                                  | Requires             |
| ------------------ | ---------------------------------------- | -------------------- |
| `normal` (default) | Plaintext SQLite `content`               | `memory.write`       |
| `sensitive`        | AES-256-GCM ciphertext + `content_nonce` | DEK + `memory.write` |

Schema columns: `sensitivity`, `encrypted`, `content_nonce` (schema v10).

DEK id: `atlas.memory.dek` (`SecretKind: "encryption_key"`). CLI loads/creates a
sync DEK beside the DB file (`.data/memory.dek`, mode `0600`) until OS keychain
adapters land.

Passphrase-encrypted **backup files** (portable across devices) are separate from
this DEK — see [Memory-Backup.md](./Memory-Backup.md) / ADR-0057.

Secret-shaped plaintext (e.g. `api_key: …`) must use `--sensitive` /
`sensitivity: "sensitive"` — credentials still belong in `SecureStorageProvider`.

---

## Permissions

| Capability      | Level | Default CLI                                     |
| --------------- | ----- | ----------------------------------------------- |
| `memory.read`   | 1     | Granted for local owner session                 |
| `memory.write`  | 2     | Granted for local owner session                 |
| `memory.delete` | 3     | Requires `--confirm` (then granted for session) |

When a `PermissionManager` is injected into `LongTermMemory`, unauthorized calls
throw `MemoryError` with code `permission_denied`.

---

## API

```ts
import {
  createLongTermMemory,
  createStaticDekProvider,
  MemoryAccessLog,
} from "@atlas-ai/memory";
import { generateAesGcmKey, PermissionManager } from "@atlas-ai/security";

const permissions = new PermissionManager({
  grantedCapabilities: ["memory.read", "memory.write"],
});
const accessLog = new MemoryAccessLog();
const ltm = createLongTermMemory(db.memories, {
  permissions,
  dek: createStaticDekProvider(generateAesGcmKey()),
  accessLog,
  logger, // category: security — redacted context only
});

ltm.store({
  type: "semantic",
  content: "private note",
  sensitivity: "sensitive",
});
ltm.secureDelete(id); // overwrite + delete
```

Search/retrieve decrypt encrypted candidates before scoring when the DEK is
available.

---

## CLI

```bash
pnpm atlas memory add --type semantic --sensitive "private note"
pnpm atlas memory delete <id> --confirm
pnpm atlas memory clear --confirm
pnpm atlas memory purge-expired --confirm
```

---

## Out of scope

- SQLCipher / whole-file encryption
- OS Keychain platform adapters (DEK file is interim)
- Durable SQLite audit table (in-process `MemoryAccessLog` + security logs)
- HTTP Memory API / Desktop Memory UI
- Full multi-domain `.atlasbackup` (use Memory-Backup for memories only)
