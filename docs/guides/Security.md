# Atlas AI — Security Baseline

Foundation rules for permissions, secure storage, and sensitive data.

**Principle:** _The AI can suggest actions, but the user owns the final authority._

Related: [Architecture/06-Security-Architecture.md](../Architecture/06-Security-Architecture.md), [`@atlas-ai/security`](../../packages/security/), [ADR-0006](../adr/0006-security-baseline.md), [ADR-0014](../adr/0014-permission-management-foundation.md), [Configuration.md](./Configuration.md), [Logging.md](./Logging.md).

---

## Core principles

1. **Zero trust** — no tool/agent runs without validation.
2. **Least privilege** — request only the capability needed.
3. **Human control** — users own permissions, data, and automation.
4. **Transparency** — explain what, why, and what happened.
5. **Local-first privacy** — secrets and monitoring stay on-device by default.

---

## Permission tiers (product)

| Tier                       | Meaning                                                           | Architecture levels |
| -------------------------- | ----------------------------------------------------------------- | ------------------- |
| **Read Only**              | Public info and user data reads (e.g. file search after grant)    | 0–1                 |
| **User Approval Required** | Sensitive writes / system / critical ops until the user decides   | 2–3                 |
| **Trusted Execution**      | Capability was granted (or approved once); later runs may proceed | 1–3 with grant      |

Examples:

- Reading files → **Read Only**; blocked until granted, then **Trusted Execution**.
- Deleting files → **User Approval Required**; blocked until approved; after approve → **Trusted Execution** until revoked.

---

## Permission model (foundation)

Capability-based. Levels from Security Architecture:

| Level | Name                | Rule (no prior grant)                                                         |
| ----- | ------------------- | ----------------------------------------------------------------------------- |
| **0** | Public information  | Allow (e.g. `system.info`)                                                    |
| **1** | User data access    | Requires **grant** (e.g. `filesystem.read`)                                   |
| **2** | System actions      | Requires **confirmation** (e.g. `terminal.execute`, `filesystem.write`)       |
| **3** | Critical operations | Requires **explicit approval** (e.g. `filesystem.delete`, `software.install`) |

Once a capability is **granted** (via approval workflow), later checks use **Trusted Execution** (`decision: allow`) until revoked.

### Primary API — `PermissionManager`

Actions request permissions; decisions are recorded; sensitive actions are blocked.

```ts
import { PermissionManager, isActionBlocked } from "@atlas-ai/security";

const permissions = new PermissionManager();

const check = permissions.requestPermission({
  capability: "filesystem.delete",
  reason: "Remove obsolete build artifacts",
  resource: "/Projects/OldApp/dist",
});

if (check.blocked) {
  // Do not execute — approval is pending at check.approval
  // User decides:
  permissions.resolveApproval(check.approval!.id, "approved"); // or "denied"
}

// Audit
permissions.listDecisions(); // allowed | blocked | approved | denied | cancelled
```

Low-level policy remains `evaluatePermission()` / `isActionBlocked()`.

**ExecutionController** and **ToolExecutor** (`checkPermissions: true`) call `PermissionManager.requestPermission()` so checks are audited.

---

## Approval workflow foundation

```
Tool / Agent requests action
        ↓
permissions.requestPermission(...)
        ↓
   allow? → execute + decision recorded (allowed)
        ↓
blocked?
        ↓
ApprovalWorkflow.create(...)  → pending (Permission Center UI later)
        ↓
resolveApproval(approve | deny | cancel)
        ↓
if approved → grant capability + decision recorded
else → decision recorded; action stays blocked
```

| Decision                    | Meaning                                             |
| --------------------------- | --------------------------------------------------- |
| `allow`                     | Proceed (Level 0 or Trusted Execution)              |
| `require_grant`             | User must grant capability first (Level 1)          |
| `require_confirmation`      | Confirm this Level 2 action                         |
| `require_explicit_approval` | Explicit Level 3 approval (delete/install/settings) |
| `deny`                      | Reserved for hard policy denies (future)            |

UI IPC for prompts is **not** wired yet; payloads + `ApprovalWorkflow` are ready.

---

## Secure storage approach

| Kind                     | Approach                                    |
| ------------------------ | ------------------------------------------- |
| Non-secret config        | `config/*.json` + `@atlas-ai/config`        |
| Local overrides          | `.env` / env vars (gitignored) — interim    |
| **Secrets (MVP target)** | **OS keychain** via `SecureStorageProvider` |
| Future                   | Optional secure vault                       |

Never store API keys / passwords / tokens in:

- Source code
- `config/*.json`
- `VITE_*` frontend env
- Plain log lines

Interface: `SecureStorageProvider` in `@atlas-ai/security`.  
Platform adapters (Keychain / Credential Manager / Secret Service) come next; until then `UnconfiguredSecureStorage` fails closed. Use `MemorySecureStorage` **only in tests**.

---

## Sensitive data handling

| Class         | Examples                    | Rules                                                                  |
| ------------- | --------------------------- | ---------------------------------------------------------------------- |
| **Public**    | Clock, generic system info  | Low protection; Level 0 OK                                             |
| **Personal**  | Documents, memory notes     | High; Level 1+; prefer redact in logs                                  |
| **Sensitive** | Passwords, API keys, tokens | Critical; keychain only; always redact; do not persist in DB plaintext |

Helpers: `classifyData()`, `isSensitiveFieldName()`, `SENSITIVE_DATA_RULES`.

Logging already redacts secret-shaped keys (`@atlas-ai/logging` redact).

---

## Audit expectations

`PermissionManager` records every check and approval resolution in `PermissionDecisionLog` (in-memory; persist later):

- timestamp, capability, reason, resource
- evaluation + product tier
- outcome: allowed | blocked | approved | denied | cancelled
- approval id when applicable

Prefer `category: "security"` in structured logs when bridging to `@atlas-ai/logging`.

---

## Package commands

```bash
pnpm security:build
pnpm test   # includes packages/security unit tests
```
