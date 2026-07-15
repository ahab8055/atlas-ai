# Atlas AI — Security Baseline

Foundation rules for permissions, secure storage, and sensitive data.

**Principle:** _The AI can suggest actions, but the user owns the final authority._

Related: [Architecture/06-Security-Architecture.md](../Architecture/06-Security-Architecture.md), [`@atlas-ai/security`](../../packages/security/), [ADR-0006](../adr/0006-security-baseline.md), [Configuration.md](./Configuration.md), [Logging.md](./Logging.md).

---

## Core principles

1. **Zero trust** — no tool/agent runs without validation.
2. **Least privilege** — request only the capability needed.
3. **Human control** — users own permissions, data, and automation.
4. **Transparency** — explain what, why, and what happened.
5. **Local-first privacy** — secrets and monitoring stay on-device by default.

---

## Permission model (foundation)

Capability-based. Levels from Security Architecture:

| Level | Name                | Rule                                                                          |
| ----- | ------------------- | ----------------------------------------------------------------------------- |
| **0** | Public information  | Allow (e.g. `system.info`)                                                    |
| **1** | User data access    | Requires **granted** permission (e.g. `filesystem.read`)                      |
| **2** | System actions      | Requires **confirmation** (e.g. `terminal.execute`, `filesystem.write`)       |
| **3** | Critical operations | Requires **explicit approval** (e.g. `filesystem.delete`, `software.install`) |

Implemented in `@atlas-ai/security` as `evaluatePermission()`.

```ts
import { evaluatePermission, isActionBlocked } from "@atlas-ai/security";

const evaluation = evaluatePermission({
  capability: "filesystem.delete",
  reason: "Remove obsolete build artifacts",
  resource: "/Projects/OldApp/dist",
});

if (isActionBlocked(evaluation)) {
  // Must not execute — go through approval flow
}
```

**Future system access** (files, terminal, apps) **must** call this (or a successor policy engine) before execution.

---

## Planned approval flow

```
Tool / Agent requests action
        ↓
evaluatePermission(...)
        ↓
   allow? → execute + audit log
        ↓
requires user action?
        ↓
createApprovalRequest(...)  → Permission Center UI (desktop)
        ↓
user: approve | deny | cancel
        ↓
if approved → execute + audit log
else → deny + audit log
```

| Decision                    | Meaning                                             |
| --------------------------- | --------------------------------------------------- |
| `allow`                     | Proceed (Level 0 or prior Level 1 grant)            |
| `require_grant`             | User must grant capability first                    |
| `require_confirmation`      | Confirm this instance of a Level 2 action           |
| `require_explicit_approval` | Explicit Level 3 approval (delete/install/settings) |
| `deny`                      | Reserved for hard policy denies (future)            |

UI IPC for prompts is **not** wired yet; the payload shape is ready via `createApprovalRequest`.

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

## Audit expectations (next)

Every important tool action should eventually log:

- timestamp, agent, tool, action
- permission result / approval id
- execution result

Use `category: "security"` in structured logs for permission decisions.

---

## Package commands

```bash
pnpm security:build
pnpm test   # includes packages/security unit tests
```
