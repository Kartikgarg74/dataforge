import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";

async function readResponseBody(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return new TextDecoder().decode(buffer);
}

describe("api/chat route", () => {
  it("streams start and end events for valid payload", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.1.1",
      },
      body: JSON.stringify({
        threadId: "integration-thread-1",
        messages: [{ role: "user", content: "show schema" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await readResponseBody(response);
    expect(payload).toContain("event: start");
    expect(payload).toContain("event: tool_result");
    expect(payload).toContain("event: end");
  });

  it("returns error stream for invalid payload", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.0.1.2",
      },
      body: JSON.stringify({
        messages: [],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const payload = await readResponseBody(response);
    expect(payload).toContain("event: error");
    expect(payload).toContain("Invalid chat payload");
  });
});
