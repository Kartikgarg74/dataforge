# YC Technical Due-Diligence Deck (Draft)

## 1) Product and Architecture Snapshot

- Product: AI-assisted SQL exploration with generated visual components.
- Frontend: Next.js 15 + React 19.
- APIs: App Router handlers under `src/app/api`.
- State: Zustand stores for chat/canvas/interactable state.
- Database: SQLite for local, Postgres/Neon for production path.

## 2) System Boundaries

- Client submits prompts and SQL requests.
- API layer validates, enforces route protections, and executes tools.
- Chat endpoint emits SSE stream events.
- Data access layer enforces read-only SQL constraints.

## 3) Security Controls

- Shared API protection guard for auth + route-level rate limiting.
- Read-only SQL enforcement with explicit keyword and statement restrictions.
- Identifier validation for schema/row-count paths.
- Optional API key enforcement via environment flags.

## 4) Reliability and Operations

- Structured request logs across critical APIs.
- In-memory route metrics (request volume, error count, latency samples).
- Alert thresholds for elevated error rate and P95 latency.
- Health endpoint exposes status + metrics + recent alerts.

## 5) Performance and Scale Baseline

- Automated load benchmark script with reproducible scenarios.
- Baseline scenarios cover query, schema, and chat stream endpoints.
- SQLite throughput tuning: shared read-only connection reuse.

## 6) Test Coverage Summary

- Unit tests: API guard behavior.
- Integration tests: DB guardrails + chat stream route behavior.
- E2E smoke: chat page shell rendering.

## 7) Data and Migration Discipline

- SQL migration and seed pipelines for SQLite and Postgres.
- Idempotent tracking tables `_migrations` and `_seed_runs`.

## 8) Risks and Mitigations

- Risk: In-memory observability data is process-local.
  - Mitigation: planned external telemetry sink integration.
- Risk: Python execution endpoint complexity.
  - Mitigation: bounded input, timeout, and execution controls.
- Risk: SSE under prolonged high concurrency.
  - Mitigation: baseline load tests and route-level throttling.

## 9) Current Maturity Statement

- Engineering readiness: MVP with core safety controls and baseline operations instrumentation.
- Remaining work: distributed observability backend, full-scale load profile by environment, and incident runbooks.

## 10) Artifacts for Review

- Architecture decision docs in `docs/`.
- Automated tests in `tests/`.
- Load test output in `reports/` after baseline run.
