# Integration tests

Cross-package Vitest suites:

| Suite                             | Guide                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 1 Core Runtime              | [Phase1-Integration-Testing.md](../../docs/guides/Phase1-Integration-Testing.md)                   |
| Phase 2 Local AI Engine           | [Phase2-Local-AI-Integration-Testing.md](../../docs/guides/Phase2-Local-AI-Integration-Testing.md) |
| Phase 3 Memory & Personal Context | [Phase3-Memory-Integration-Testing.md](../../docs/guides/Phase3-Memory-Integration-Testing.md)     |

Optional live llama probe: `ai-runtime.test.ts` (skipped unless `ATLAS_AI_ENDPOINT` is set).

```bash
pnpm test:integration
```
