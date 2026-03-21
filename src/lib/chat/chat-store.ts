import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ChatRole = "system" | "user" | "assistant" | "tool";
export type ChatStatus = "idle" | "submitting" | "streaming" | "error";

export interface ChatComponentPayload {
  componentType: string;
  props: Record<string, unknown>;
}

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  components?: ChatComponentPayload[];
  toolCalls?: ChatToolCall[];
}

interface ChatState {
  runtime: "tambo" | "native";
  threadId: string | null;
  status: ChatStatus;
  lastError: string | null;
  messages: ChatMessage[];
  setRuntime: (runtime: "tambo" | "native") => void;
  setThreadId: (threadId: string | null) => void;
  setStatus: (status: ChatStatus) => void;
  setLastError: (error: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  upsertMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  resetThread: () => void;
}

const STORAGE_KEY = "native-chat-store-v1";

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      runtime: "tambo",
      threadId: null,
      status: "idle",
      lastError: null,
      messages: [],
      setRuntime: (runtime) => set({ runtime }),
      setThreadId: (threadId) => set({ threadId }),
      setStatus: (status) => set({ status }),
      setLastError: (error) => set({ lastError: error }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      upsertMessage: (message) =>
        set((state) => {
          const existingIndex = state.messages.findIndex((m) => m.id === message.id);
          if (existingIndex === -1) {
            return { messages: [...state.messages, message] };
          }

          const nextMessages = [...state.messages];
          nextMessages[existingIndex] = message;
          return { messages: nextMessages };
        }),
      clearMessages: () => set({ messages: [] }),
      resetThread: () =>
        set({
          status: "idle",
          lastError: null,
          messages: [],
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        runtime: state.runtime,
        threadId: state.threadId,
        messages: state.messages,
      }),
    },
  ),
);
