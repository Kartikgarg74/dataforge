"use client";

import { useChatStore } from "@/lib/chat/chat-store";
import { useEffect, type PropsWithChildren } from "react";

interface ChatProviderProps extends PropsWithChildren {
  threadId: string;
  runtime?: "tambo" | "native";
}

export function ChatProvider({
  children,
  threadId,
  runtime = "tambo",
}: ChatProviderProps) {
  const setThreadId = useChatStore((state) => state.setThreadId);
  const setRuntime = useChatStore((state) => state.setRuntime);
  const resetThread = useChatStore((state) => state.resetThread);

  useEffect(() => {
    setRuntime(runtime);
  }, [runtime, setRuntime]);

  useEffect(() => {
    const previousThread = useChatStore.getState().threadId;
    if (previousThread && previousThread !== threadId) {
      resetThread();
    }
    setThreadId(threadId);
  }, [threadId, setThreadId, resetThread]);

  return children;
}
