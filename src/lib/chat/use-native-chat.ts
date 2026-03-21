"use client";

import { useCallback } from "react";
import { useChatActions, useChatState, createAssistantMessage, createUserMessage } from "@/lib/chat/use-chat-state";
import { useChatStore, type ChatToolCall } from "@/lib/chat/chat-store";
import { streamChatCompletion } from "@/lib/chat/stream-client";
import { useMcpServers } from "@/lib/mcp/client";

export function useNativeChat() {
  const { runtime, threadId, messages } = useChatState();
  const { addMessage, upsertMessage, setLastError, setStatus } = useChatActions();
  const mcpServers = useMcpServers();

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text) return;
      if (runtime !== "native") {
        setLastError("Native runtime is disabled. Switch runtime before sending native chat messages.");
        return;
      }
      if (!threadId) {
        setLastError("No thread is active for native chat.");
        return;
      }

      const userMessage = createUserMessage(text);
      const assistantMessage = createAssistantMessage("");

      addMessage(userMessage);
      addMessage(assistantMessage);
      setLastError(null);
      setStatus("streaming");

      await streamChatCompletion(
        {
          threadId,
          messages: [...messages, userMessage].map((message) => ({
            role:
              message.role === "tool"
                ? "assistant"
                : (message.role as "system" | "user" | "assistant"),
            content: message.content,
          })),
          mcp: {
            servers: mcpServers,
          },
        },
        {
          onDelta: ({ delta }) => {
            const current = useChatStore
              .getState()
              .messages.find((m) => m.id === assistantMessage.id)?.content || "";
            upsertMessage({
              ...assistantMessage,
              content: `${current}${delta}`,
            });
          },
          onToolStart: ({ callId, name, input }) => {
            const state = useChatStore.getState();
            const currentMessage = state.messages.find((m) => m.id === assistantMessage.id);
            const toolCalls = [...(currentMessage?.toolCalls || [])];
            toolCalls.push({ id: callId, name, input });

            upsertMessage({
              ...(currentMessage || assistantMessage),
              toolCalls,
            });
          },
          onToolResult: ({ callId, output }) => {
            const state = useChatStore.getState();
            const currentMessage = state.messages.find((m) => m.id === assistantMessage.id);
            const nextToolCalls = (currentMessage?.toolCalls || []).map((call) =>
              call.id === callId
                ? ({ ...call, output } as ChatToolCall)
                : call
            );

            upsertMessage({
              ...(currentMessage || assistantMessage),
              toolCalls: nextToolCalls,
            });
          },
          onToolError: ({ callId, error }) => {
            const state = useChatStore.getState();
            const currentMessage = state.messages.find((m) => m.id === assistantMessage.id);
            const nextToolCalls = (currentMessage?.toolCalls || []).map((call) =>
              call.id === callId
                ? ({ ...call, error } as ChatToolCall)
                : call
            );

            upsertMessage({
              ...(currentMessage || assistantMessage),
              toolCalls: nextToolCalls,
            });
          },
          onEnd: () => {
            setStatus("idle");
          },
          onError: (error) => {
            setLastError(error);
            setStatus("error");
          },
        }
      );
    },
    [addMessage, mcpServers, messages, runtime, setLastError, setStatus, threadId, upsertMessage]
  );

  return { sendMessage };
}
