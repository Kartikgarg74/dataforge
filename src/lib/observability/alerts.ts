import { logWarn } from "@/lib/observability/logger";
import { getRouteSummary } from "@/lib/observability/metrics";

interface AlertEvent {
  id: string;
  route: string;
  reason: string;
  triggeredAt: string;
}

const ALERT_COOLDOWN_MS = 60_000;
const MIN_VOLUME_FOR_ALERT = 20;
const recentAlerts: AlertEvent[] = [];
const lastAlertAt = new Map<string, number>();

function shouldFire(key: string): boolean {
  const now = Date.now();
  const previous = lastAlertAt.get(key) || 0;
  if (now - previous < ALERT_COOLDOWN_MS) {
    return false;
  }
  lastAlertAt.set(key, now);
  return true;
}

function pushAlert(route: string, reason: string): void {
  const event: AlertEvent = {
    id: `${route}:${Date.now()}`,
    route,
    reason,
    triggeredAt: new Date().toISOString(),
  };
  recentAlerts.push(event);
  if (recentAlerts.length > 100) {
    recentAlerts.splice(0, recentAlerts.length - 100);
  }
  logWarn("ops.alert.triggered", { ...event });
}

export function evaluateRouteAlerts(route: string): void {
  const summary = getRouteSummary(route);
  if (summary.requestCount < MIN_VOLUME_FOR_ALERT) {
    return;
  }

  const errorKey = `${route}:error-rate`;
  if (summary.errorRate >= 0.1 && shouldFire(errorKey)) {
    pushAlert(route, `Error rate exceeded threshold: ${(summary.errorRate * 100).toFixed(1)}%`);
  }

  const latencyKey = `${route}:p95-latency`;
  if (summary.p95LatencyMs >= 1500 && shouldFire(latencyKey)) {
    pushAlert(route, `P95 latency exceeded threshold: ${summary.p95LatencyMs.toFixed(1)}ms`);
  }
}

export function getRecentAlerts(): AlertEvent[] {
  return [...recentAlerts];
}
