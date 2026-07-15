# `@atlas-ai/security`

Security baseline for Atlas AI: permission tiers, request API, approval workflow, decision audit, sensitive data rules, and secure storage interfaces.

```ts
import { PermissionManager } from "@atlas-ai/security";

const permissions = new PermissionManager();

const check = permissions.requestPermission({
  capability: "filesystem.delete",
  reason: "remove old build output",
  resource: "/Projects/OldApp/dist",
});

if (check.blocked) {
  // User Approval Required — do not execute
  permissions.resolveApproval(check.approval!.id, "approved");
}

permissions.listDecisions(); // audit trail
```

See [docs/guides/Security.md](../../docs/guides/Security.md) and [ADR-0014](../../docs/adr/0014-permission-management-foundation.md).
