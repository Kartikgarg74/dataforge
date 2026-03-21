import { describe, expect, it } from "vitest";
import { enforceApiProtection } from "@/lib/security/api-guard";

function withEnv<T>(updates: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("enforceApiProtection", () => {
  it("returns unauthorized when key is required and missing", async () => {
    const request = new Request("http://localhost/api/query", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    });

    const response = withEnv(
      {
        API_AUTH_REQUIRED: "false",
        API_AUTH_KEY: "test-secret",
      },
      () =>
        enforceApiProtection(request, {
          route: "unit-auth-missing",
          rateLimit: { windowMs: 60_000, max: 10 },
          requireApiKey: true,
        }),
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns configuration error when key is required but not configured", async () => {
    const request = new Request("http://localhost/api/query", {
      headers: {
        "x-forwarded-for": "10.0.0.2",
      },
    });

    const response = withEnv(
      {
        API_AUTH_REQUIRED: "false",
        API_AUTH_KEY: undefined,
      },
      () =>
        enforceApiProtection(request, {
          route: "unit-auth-misconfig",
          rateLimit: { windowMs: 60_000, max: 10 },
          requireApiKey: true,
        }),
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({
      error: "Server auth misconfiguration: API_AUTH_KEY is not set",
    });
  });

  it("enforces per-route rate limits", async () => {
    const request = new Request("http://localhost/api/query", {
      headers: {
        "x-forwarded-for": "10.0.0.3",
      },
    });

    const first = withEnv(
      {
        API_AUTH_REQUIRED: "false",
        API_AUTH_KEY: undefined,
      },
      () =>
        enforceApiProtection(request, {
          route: "unit-rate-limit",
          rateLimit: { windowMs: 60_000, max: 1 },
          requireApiKey: false,
        }),
    );

    const second = withEnv(
      {
        API_AUTH_REQUIRED: "false",
        API_AUTH_KEY: undefined,
      },
      () =>
        enforceApiProtection(request, {
          route: "unit-rate-limit",
          rateLimit: { windowMs: 60_000, max: 1 },
          requireApiKey: false,
        }),
    );

    expect(first).toBeNull();
    expect(second).not.toBeNull();
    expect(second?.status).toBe(429);
    expect(second?.headers.get("Retry-After")).toBeTruthy();
    expect(await second?.json()).toEqual({ error: "Too many requests" });
  });
});
