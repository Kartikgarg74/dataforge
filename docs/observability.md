# Observability, Monitoring, and Alerts

## Scope

The API layer now emits structured logs, captures route-level metrics, and evaluates lightweight alert thresholds.

Implemented modules:

- `src/lib/observability/logger.ts`
- `src/lib/observability/metrics.ts`
- `src/lib/observability/alerts.ts`
- `src/lib/observability/request-monitor.ts`

## API Coverage

Request start/finish/error instrumentation is wired into:

- `POST /api/chat`
- `POST /api/query`
- `POST /api/python`
- `POST /api/neon`

## Health Endpoint

`GET /api/health` returns:

- service status
- environment
- uptime
- in-memory metrics snapshot
- recent alert events

## Alert Thresholds

Per route alert rules are evaluated after request completion:

- Error rate >= 10% with at least 20 requests
- P95 latency >= 1500ms with at least 20 requests

A 60-second cooldown is applied per alert key to avoid floods.

## Operational Notes

- This is an in-memory baseline for pre-production and MVP operations.
- For production hardening, route these signals to external sinks (Datadog/New Relic/OpenTelemetry backend).
- The structured JSON log format is intentionally compatible with log forwarders.
