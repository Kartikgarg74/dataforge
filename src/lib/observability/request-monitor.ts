import { evaluateRouteAlerts } from "@/lib/observability/alerts";
import { logError, logInfo } from "@/lib/observability/logger";
import { recordRequestMetric } from "@/lib/observability/metrics";

export interface RequestContext {
  route: string;
  requestId: string;
  startedAt: number;
  method: string;
  path: string;
}

function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export function beginRequest(route: string, request: Request): RequestContext {
  const context: RequestContext = {
    route,
    requestId: crypto.randomUUID(),
    startedAt: Date.now(),
    method: request.method,
    path: requestPath(request),
  };

  logInfo("api.request.start", {
    route,
    requestId: context.requestId,
    method: context.method,
    path: context.path,
  });

  return context;
}

export function completeRequest(
  context: RequestContext,
  statusCode: number,
  extra: Record<string, unknown> = {},
): void {
  const durationMs = Date.now() - context.startedAt;
  recordRequestMetric(context.route, statusCode, durationMs);
  evaluateRouteAlerts(context.route);

  logInfo("api.request.complete", {
    route: context.route,
    requestId: context.requestId,
    statusCode,
    durationMs,
    ...extra,
  });
}

export function failRequest(
  context: RequestContext,
  error: unknown,
  statusCode = 500,
): void {
  const durationMs = Date.now() - context.startedAt;
  recordRequestMetric(context.route, statusCode, durationMs);
  evaluateRouteAlerts(context.route);

  logError("api.request.error", {
    route: context.route,
    requestId: context.requestId,
    statusCode,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  });
}
