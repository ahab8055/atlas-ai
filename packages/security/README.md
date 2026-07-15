# `@atlas-ai/security`

Security baseline for Atlas AI: permission levels, approval planning, sensitive data rules, and secure storage interfaces.

```ts
import { evaluatePermission, createApprovalRequest } from "@atlas-ai/security";

const evaluation = evaluatePermission({
  capability: "terminal.execute",
  reason: "run project tests",
});

if (evaluation.requiresUserAction) {
  const approval = createApprovalRequest("apr_1", { ... }, evaluation);
  // Future: show Permission Center UI
}
```

See [docs/guides/Security.md](../../docs/guides/Security.md).
