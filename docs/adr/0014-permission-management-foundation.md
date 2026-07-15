# ADR-0014: Permission management foundation

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

The security baseline (ADR-0006) defined Architecture levels 0–3 and `evaluatePermission`. Core runtime needed a checking layer that matches the product story: **Read Only**, **User Approval Required**, and **Trusted Execution**; records decisions; and can block sensitive actions. Execution and tools already depended on policy helpers but did not share an approval workflow or audit trail.

## Decision

1. Keep Architecture levels 0–3 as the policy engine (`evaluatePermission`).
2. Add product tiers mapped onto those levels (`tierForLevel` / Trusted Execution when granted).
3. Ship `PermissionManager` as the primary request API: `requestPermission` → evaluate → record → create pending approval when blocked; `resolveApproval` → grant on approve and record.
4. Add `ApprovalWorkflow` + `PermissionDecisionLog` (in-memory foundation).
5. Wire `ExecutionController` and `ToolExecutor` to `PermissionManager.requestPermission`.
6. Prior grant enables Trusted Execution for levels 1–3 until revoked (explicit first-time approval still required).

## Consequences

### Positive

- Actions have one request path; decisions are auditable; deletes stay blocked until approved.
- Aligns ExecutionController / ToolExecutor with the same manager.
- Ready for desktop Permission Center IPC without changing policy codes.

### Negative / trade-offs

- Decision log is process-local until persistence lands.
- UI prompts still stubbed; resolve must be called by host code/tests.
- Session-wide grants after one approve are intentional for Trusted Execution — hosts may revoke.

### Follow-ups

- Desktop IPC + Permission Center UI.
- Persist decision log / grants.
- Bridge records into structured `category: "security"` logs.
