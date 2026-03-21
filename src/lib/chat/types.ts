export type NativeChatRole = "system" | "user" | "assistant";

export interface NativeChatMessage {
  role: NativeChatRole;
  content: string;
}

export interface NativeChatRequest {
  threadId: string;
  messages: NativeChatMessage[];
  mcp?: {
    servers: {
      url: string;
      transport?: "http" | "sse";
      name?: string;
    }[];
  };
}

export type NativeChatStreamEvent =
  | { type: "start"; threadId: string; messageId: string }
  | { type: "delta"; delta: string }
  | { type: "tool_start"; callId: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; callId: string; name: string; output: unknown }
  | { type: "tool_error"; callId: string; name: string; error: string }
  | { type: "end" }
  | { type: "error"; error: string };
