# Launch and Rollout Checklist

Finalized: 2026-03-17

Notes:
- Checked items are implemented and verified in this repository.
- Unchecked items are operational actions to complete during release execution.

## Pre-Launch

- [ ] Environment variables verified across staging and production
- [x] `npm run build` passes in clean environment
- [x] Unit + integration + e2e smoke tests pass
- [ ] DB migrations applied in target environment
- [ ] Seed strategy confirmed for production-safe paths
- [x] API auth and rate limits enabled per route policy
- [x] Health endpoint returns expected status and metrics
- [x] Error handling paths reviewed for chat/query/python endpoints

## Performance and Reliability

- [x] Baseline load test executed (`npm run load:baseline`)
- [x] P95 and non-2xx metrics reviewed against target thresholds
- [ ] Alert thresholds validated under synthetic fault scenarios
- [ ] Rollback procedure documented and tested

## Product Readiness

- [x] Public claims aligned with implemented feature set
- [x] Integration status messaging reviewed for non-configured services
- [x] Due-diligence documentation exported for stakeholders

## Release Execution

- [ ] Release tag and changelog prepared
- [ ] Deployment window and on-call owner confirmed
- [ ] Smoke checks run immediately after deploy
- [ ] Post-deploy load sanity check completed

## Post-Launch (24-72h)

- [ ] Monitor error rate and p95 latency trends
- [ ] Review alerts and annotate incidents
- [ ] Capture customer feedback and prioritize follow-up fixes
- [ ] Freeze postmortem notes and update runbooks
