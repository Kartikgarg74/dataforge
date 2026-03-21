# Product Claims Alignment

## Purpose

Align external-facing claims with currently implemented behavior.

## Claim Matrix

| Claim | Status | Evidence |
|---|---|---|
| Native chat streaming pipeline is implemented | Accurate | `src/app/api/chat/route.ts`, `src/lib/chat/*` |
| API routes are auth/rate-limit protected | Accurate | `src/lib/security/api-guard.ts`, route imports |
| Read-only SQL safety checks exist | Accurate | `src/db/connection.ts`, `src/app/api/query/route.ts` |
| Python transformations execute in-process runner | Accurate | `src/app/api/python/route.ts` |
| Multi-service integrations are production-complete | Not accurate | Several routes intentionally return not configured status |
| Observability and alerting exists | Accurate (baseline/in-memory) | `src/lib/observability/*`, `src/app/api/health/route.ts` |
| Load-testing baseline is automated | Accurate | `scripts/load-baseline.cjs`, `npm run load:baseline` |

## Messaging Guidance

Use these approved statements externally:

- "Core APIs include auth/rate-limit guardrails and read-only SQL protections."
- "Chat uses a native SSE pipeline with tool orchestration."
- "Production integrations for some external services are in staged rollout."
- "Baseline observability and load benchmarking are in place and being expanded."

Avoid these statements until implemented:

- "All integrations are production-ready."
- "Distributed monitoring stack is fully deployed."
- "System has completed high-scale capacity certification."
