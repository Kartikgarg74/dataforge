interface RouteMetrics {
  route: string;
  requestCount: number;
  errorCount: number;
  statusCounts: Record<string, number>;
  latencyMsSamples: number[];
  lastSeenAt: string | null;
}

interface MetricsSnapshot {
  totalRequests: number;
  totalErrors: number;
  uptimeSeconds: number;
  routes: RouteMetrics[];
}

const METRIC_SAMPLE_LIMIT = 400;
const startedAt = Date.now();
const routeStore = new Map<string, RouteMetrics>();

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(index, 0)];
}

function getOrCreateRoute(route: string): RouteMetrics {
  const existing = routeStore.get(route);
  if (existing) return existing;

  const created: RouteMetrics = {
    route,
    requestCount: 0,
    errorCount: 0,
    statusCounts: {},
    latencyMsSamples: [],
    lastSeenAt: null,
  };
  routeStore.set(route, created);
  return created;
}

export function recordRequestMetric(route: string, statusCode: number, durationMs: number): void {
  const item = getOrCreateRoute(route);
  item.requestCount += 1;
  if (statusCode >= 500) {
    item.errorCount += 1;
  }
  const statusKey = String(statusCode);
  item.statusCounts[statusKey] = (item.statusCounts[statusKey] || 0) + 1;

  item.latencyMsSamples.push(durationMs);
  if (item.latencyMsSamples.length > METRIC_SAMPLE_LIMIT) {
    item.latencyMsSamples.splice(0, item.latencyMsSamples.length - METRIC_SAMPLE_LIMIT);
  }
  item.lastSeenAt = new Date().toISOString();
}

export function getRouteSummary(route: string): {
  route: string;
  requestCount: number;
  errorRate: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
} {
  const item = getOrCreateRoute(route);
  const errorRate = item.requestCount === 0 ? 0 : item.errorCount / item.requestCount;
  return {
    route,
    requestCount: item.requestCount,
    errorRate,
    p95LatencyMs: percentile(item.latencyMsSamples, 95),
    p99LatencyMs: percentile(item.latencyMsSamples, 99),
  };
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const routes = Array.from(routeStore.values()).map((item) => ({
    ...item,
    latencyMsSamples: [...item.latencyMsSamples],
  }));

  const totalRequests = routes.reduce((sum, route) => sum + route.requestCount, 0);
  const totalErrors = routes.reduce((sum, route) => sum + route.errorCount, 0);

  return {
    totalRequests,
    totalErrors,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    routes,
  };
}
