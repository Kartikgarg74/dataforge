"use client";

import type { NativeChatRequest, NativeChatStreamEvent } from "@/lib/chat/types";

interface StreamHandlers {
  onStart?: (event: Extract<NativeChatStreamEvent, { type: "start" }>) => void;
  onDelta?: (event: Extract<NativeChatStreamEvent, { type: "delta" }>) => void;
  onToolStart?: (event: Extract<NativeChatStreamEvent, { type: "tool_start" }>) => void;
  onToolResult?: (event: Extract<NativeChatStreamEvent, { type: "tool_result" }>) => void;
  onToolError?: (event: Extract<NativeChatStreamEvent, { type: "tool_error" }>) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

function parseSseEvent(block: string): { event?: string; data?: string } {
  const lines = block.split("\n").map((line) => line.trim());
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));

  return {
    event: eventLine?.replace(/^event:\s*/, ""),
    data: dataLine?.replace(/^data:\s*/, ""),
  };
}

export async function streamChatCompletion(
  payload: NativeChatRequest,
  handlers: StreamHandlers
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    handlers.onError?.(`Streaming request failed with status ${response.status}`);
    return;
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  let buffered = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });

    let boundary = buffered.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffered.slice(0, boundary).trim();
      buffered = buffered.slice(boundary + 2);

      if (rawEvent) {
        const { event, data } = parseSseEvent(rawEvent);
        if (!event || !data) {
          boundary = buffered.indexOf("\n\n");
          continue;
        }

        let parsed: NativeChatStreamEvent;
        try {
          parsed = JSON.parse(data) as NativeChatStreamEvent;
        } catch {
          handlers.onError?.("Failed to parse streaming payload");
          boundary = buffered.indexOf("\n\n");
          continue;
        }

        if (event === "start" && parsed.type === "start") {
          handlers.onStart?.(parsed);
        } else if (event === "delta" && parsed.type === "delta") {
          handlers.onDelta?.(parsed);
        } else if (event === "tool_start" && parsed.type === "tool_start") {
          handlers.onToolStart?.(parsed);
        } else if (event === "tool_result" && parsed.type === "tool_result") {
          handlers.onToolResult?.(parsed);
        } else if (event === "tool_error" && parsed.type === "tool_error") {
          handlers.onToolError?.(parsed);
        } else if (event === "end") {
          handlers.onEnd?.();
        } else if (event === "error" && parsed.type === "error") {
          handlers.onError?.(parsed.error);
        }
      }

      boundary = buffered.indexOf("\n\n");
    }
  }
}
