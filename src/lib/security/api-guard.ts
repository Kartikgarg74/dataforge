import { NextResponse } from "next/server";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface ApiProtectionOptions {
  route: string;
  rateLimit: RateLimitOptions;
  requireApiKey?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function getPresentedApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey?.trim()) {
    return headerKey.trim();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isApiKeyRequired(override?: boolean): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  return process.env.API_AUTH_REQUIRED === "true";
}

function cleanupRateLimitStore(now: number): void {
  // Opportunistic cleanup to avoid unbounded memory growth.
  for (const [key, value] of rateLimitStore) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function enforceRateLimit(
  key: string,
  options: RateLimitOptions,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (process.env.API_RATE_LIMIT_DISABLED === "true") {
    return { ok: true };
  }

  const now = Date.now();
  cleanupRateLimitStore(now);

  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { ok: true };
  }

  if (entry.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);
  return { ok: true };
}

export function enforceApiProtection(
  request: Request,
  options: ApiProtectionOptions,
): NextResponse | null {
  const keyRequired = isApiKeyRequired(options.requireApiKey);
  const presentedApiKey = getPresentedApiKey(request);
  const expectedApiKey = process.env.API_AUTH_KEY;

  if (keyRequired) {
    if (!expectedApiKey) {
      return NextResponse.json(
        {
          error: "Server auth misconfiguration: API_AUTH_KEY is not set",
        },
        { status: 500 },
      );
    }

    if (!presentedApiKey || presentedApiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const client = getClientIdentifier(request);
  const subject = presentedApiKey || client;
  const rateKey = `${options.route}:${subject}`;
  const rateResult = enforceRateLimit(rateKey, options.rateLimit);

  if (!rateResult.ok) {
    return NextResponse.json(
      {
        error: "Too many requests",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateResult.retryAfterSeconds),
        },
      },
    );
  }

  return null;
}
