# Load Testing Baseline

## Goal

Establish a repeatable load benchmark for core API paths and capture regression signals.

## Tooling

- Runner: `autocannon`
- Script: `scripts/load-baseline.cjs`
- NPM command: `npm run load:baseline`

## Scenarios

- `POST /api/query` (read query)
- `GET /api/schema`
- `POST /api/chat` (SSE response path)

## How To Run

1. Start the app:

```bash
npm run build
API_RATE_LIMIT_DISABLED=true npm run start -- -p 3001
```

2. Run the baseline in a second terminal:

```bash
LOAD_BASE_URL=http://127.0.0.1:3001 npm run load:baseline
```

Note: Keep rate limiting enabled for normal environments. The `API_RATE_LIMIT_DISABLED=true`
setting is only for controlled benchmark runs.

3. Review generated reports:

- `reports/load-test-baseline.json`
- `reports/load-test-baseline.md`

## Pass/Fail Heuristics (initial)

- non-2xx count remains near zero under baseline load
- no timeouts in steady-state baseline runs
- P95 latency trend does not regress > 20% relative to previous run
