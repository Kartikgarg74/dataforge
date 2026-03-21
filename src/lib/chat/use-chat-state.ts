"use client";

import { useChatStore, type ChatMessage, type ChatStatus } from "@/lib/chat/chat-store";

export function useChatState() {
  const runtime = useChatStore((state) => state.runtime);
  const threadId = useChatStore((state) => state.threadId);
  const status = useChatStore((state) => state.status);
  const lastError = useChatStore((state) => state.lastError);
  const messages = useChatStore((state) => state.messages);

  return {
    runtime,
    threadId,
    status,
    lastError,
    messages,
  };
}

export function useChatActions() {
  const setStatus = useChatStore((state) => state.setStatus);
  const setLastError = useChatStore((state) => state.setLastError);
  const addMessage = useChatStore((state) => state.addMessage);
  const upsertMessage = useChatStore((state) => state.upsertMessage);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const resetThread = useChatStore((state) => state.resetThread);

  return {
    setStatus,
    setLastError,
    addMessage,
    upsertMessage,
    clearMessages,
    resetThread,
  };
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: Date.now(),
  };
}

export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: Date.now(),
  };
}

export function setChatStatus(status: ChatStatus) {
  useChatStore.getState().setStatus(status);
}
