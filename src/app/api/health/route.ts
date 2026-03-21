import { NextResponse } from "next/server";
import { getRecentAlerts } from "@/lib/observability/alerts";
import { getMetricsSnapshot } from "@/lib/observability/metrics";

export async function GET(): Promise<NextResponse> {
  const metrics = getMetricsSnapshot();
  const alerts = getRecentAlerts();

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "unknown",
    metrics,
    alerts,
  });
}
