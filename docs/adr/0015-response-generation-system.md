# ADR-0015: Response generation system

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Architecture/22 defines a Response Generator that converts execution results into user communication (explain results, summarize actions, mention failures, suggest next steps). The pipeline had a thin `stages/respond.ts` with ad-hoc strings and no structured errors, warnings, task-status framing, or voice-oriented payload. Voice (Architecture/08) needs speakable text before TTS exists.

## Decision

1. Add `packages/core/src/response/` with `ResponseGenerator` as the response module.
2. Expand `PipelineResponse` with `spokenText`, `summary`, `errors`, `warnings`, `nextSteps`, `lifecycle`, and `modality`.
3. Always include task status in user-facing text; map failure codes to clear explanations.
4. Keep help / tools / unknown as special copy paths that still carry status + spoken text.
5. Do not synthesize audio yet — only produce voice-ready text for future TTS adapters.

## Consequences

### Positive

- Meaningful, status-aware responses after tasks.
- Errors explained with actionable hints.
- Voice adapters have a stable `spokenText` field.

### Negative / trade-offs

- Template-based (not LLM) copy for MVP.
- Completed CLI answers are slightly longer (status/progress lines).

### Follow-ups

- Optional LLM polish for natural language summaries.
- Wire TTS using `spokenText` (Architecture/08).
- Desktop UI components for errors / next steps.
